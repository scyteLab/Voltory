/**
 * Product Q&A actions for customer-data (signed-in customers only).
 *
 *   question-ask    { sku, question }  → { question }   saved as 'pending'
 *   question-delete { id }             → { deleted }    own + pending + unanswered only
 *   my-questions                       → { questions }  own, all statuses
 *
 * Rules:
 *   · Any signed-in customer may ask (no purchase needed). The product
 *     must exist and be active.
 *   · 10–500 characters (code points, like Postgres char_length).
 *   · Asking: 5 per hour per customer, every attempt counts.
 *   · status, answer and the customer id are always set here, never
 *     taken from the browser.
 *   · The owner sees the staff answer only once it is published, and
 *     the staff note only when the question was not published.
 *
 * Public reads don't come here: the product page calls the
 * product_questions_public / product_questions_count RPCs.
 */
import { validateQuestion } from "../../../src/lib/questionRules.js";
import { RateLimitConfigError, createRateLimiter, tooManyRequests } from "./rateLimit.js";
import { SKU_RE } from "./reviewActions.js";

export const QUESTION_ASK_LIMIT = 5;
export const QUESTION_ASK_WINDOW_SEC = 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** product_questions row → what the asker sees (no customer_id, no staff id). */
export function toOwnQuestion(row) {
  if (!row) return null;
  const answered = row.status === "published" && Boolean(row.answer);
  return {
    id: row.id,
    productSku: row.product_sku,
    question: row.question,
    status: row.status,
    answer: answered ? row.answer : null,
    answeredAt: answered ? row.answered_at || null : null,
    adminNote: row.status === "rejected" ? row.admin_note || "" : "",
    canDelete: row.status === "pending" && !row.answer,
    createdAt: row.created_at,
  };
}

export function createQuestionActions({ db, env, attemptStore, now, log, reply }) {
  async function askGate(session) {
    let limiter;
    try {
      limiter = createRateLimiter({ store: attemptStore, pepper: env.AUTH_PEPPER, now });
    } catch (err) {
      if (err instanceof RateLimitConfigError) {
        log.error("[customer-data] AUTH_PEPPER is not set: refusing questions (fail closed). Set it in Netlify env.");
        return reply(500, { ok: false, error: "not_configured" });
      }
      throw err;
    }
    const rules = [{
      kind: "question_ask", subject: `customer:${session.customer.id}`,
      limit: QUESTION_ASK_LIMIT, windowSec: QUESTION_ASK_WINDOW_SEC, countAll: true,
    }];
    const gate = await limiter.check(rules);
    if (gate.blocked) return tooManyRequests(gate.retryAfter, { "Cache-Control": "no-store" });
    await limiter.record(rules, { success: true });
    return null;
  }

  async function ask(body, session) {
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    if (!SKU_RE.test(sku)) return reply(400, { ok: false, error: "invalid_sku" });
    const checked = validateQuestion(body.question);
    if (!checked.ok) return reply(400, { ok: false, error: checked.error });

    const blocked = await askGate(session);
    if (blocked) return blocked;

    const product = await db.getProduct(sku);
    if (!product || product.status !== "active") return reply(400, { ok: false, error: "unknown_product" });

    const row = await db.insertQuestion({
      product_sku: product.sku,
      customer_id: session.customer.id,
      question: checked.value,
      status: "pending",
    });
    return reply(200, { ok: true, question: toOwnQuestion(row) });
  }

  async function remove(body, session) {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!UUID_RE.test(id)) return reply(400, { ok: false, error: "invalid_id" });
    const own = await db.getOwnQuestion(session.customer.id, id);
    if (!own) return reply(404, { ok: false, error: "not_found" });
    if (own.status !== "pending" || own.answer) return reply(409, { ok: false, error: "not_deletable" });
    // The filter repeats the rule, so a staff answer landing in between still wins.
    const deleted = await db.deleteOwnPendingQuestion(session.customer.id, id);
    if (!deleted) return reply(409, { ok: false, error: "not_deletable" });
    return reply(200, { ok: true, deleted: true });
  }

  async function mine(session) {
    const rows = await db.listOwnQuestions(session.customer.id);
    const skus = [...new Set(rows.map((r) => r.product_sku))];
    const products = skus.length ? await db.getProducts(skus) : [];
    const bySku = new Map(products.map((p) => [p.sku, p]));
    const questions = rows.map((r) => {
      const p = bySku.get(r.product_sku);
      return {
        ...toOwnQuestion(r),
        productName: p?.name || r.product_sku,
        productSlug: p?.slug || null,
        productImage: p?.image || null,
      };
    });
    return reply(200, { ok: true, questions });
  }

  return {
    "question-ask": ask,
    "question-delete": remove,
    "my-questions": (_body, session) => mine(session),
  };
}
