/**
 * Review actions for customer-data (signed-in customers only).
 *
 *   review-eligibility { sku }                    → { canReview, existingReview, reason? }
 *   review-upsert      { sku, rating, title?, body? } → { review }
 *   review-delete      { sku }                    → { deleted }
 *   my-reviews                                    → { reviews, pendingToReview }
 *
 * Rules (decided, see docs/CUSTOMER_AUTH_LOCKDOWN_PLAN.md Phase 3):
 *   · Eligible = a DELIVERED order containing the SKU, owned by the
 *     customer (customer_id OR either phone spelling). Checked again
 *     on every write.
 *   · One review per customer per product. Every new review and every
 *     edit is saved as 'pending' (admin_note cleared); only 'approved'
 *     ones are public. order_id and status are always set here, never
 *     taken from the browser.
 *   · Writes (upsert + delete): 10 per hour per customer, every
 *     attempt counts.
 *
 * `session` comes from customer-data's single session helper.
 */
import { validateReviewInput } from "../../../src/lib/reviewRules.js";
import { RateLimitConfigError, createRateLimiter, tooManyRequests } from "./rateLimit.js";

export const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const REVIEW_WRITE_LIMIT = 10;
export const REVIEW_WRITE_WINDOW_SEC = 60 * 60;

/** reviews row → what the owner sees (no customer_id / order_id). */
export function toOwnReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    productSku: row.product_sku,
    rating: row.rating,
    title: row.title || "",
    body: row.body || "",
    status: row.status,
    adminNote: row.status === "rejected" ? row.admin_note || "" : "",
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

export function createReviewActions({ db, env, attemptStore, now, log, reply, phoneSpellings }) {
  const owner = (session) => ({
    customerId: session.customer.id,
    phones: phoneSpellings(session.customer.phone),
  });

  async function deliveredOrderId(session, sku) {
    const { customerId, phones } = owner(session);
    const row = await db.findDeliveredOrderWithSku(customerId, phones, sku);
    return row?.id || null;
  }

  function readSku(body) {
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    return SKU_RE.test(sku) ? sku : null;
  }

  /** null = allowed; otherwise the reply to send. */
  async function writeGate(session) {
    let limiter;
    try {
      limiter = createRateLimiter({ store: attemptStore, pepper: env.AUTH_PEPPER, now });
    } catch (err) {
      if (err instanceof RateLimitConfigError) {
        log.error("[customer-data] AUTH_PEPPER is not set: refusing review writes (fail closed). Set it in Netlify env.");
        return { blocked: reply(500, { ok: false, error: "not_configured" }) };
      }
      throw err;
    }
    const rules = [{
      kind: "review_write", subject: `customer:${session.customer.id}`,
      limit: REVIEW_WRITE_LIMIT, windowSec: REVIEW_WRITE_WINDOW_SEC, countAll: true,
    }];
    const gate = await limiter.check(rules);
    if (gate.blocked) return { blocked: tooManyRequests(gate.retryAfter, { "Cache-Control": "no-store" }) };
    await limiter.record(rules, { success: true });
    return { blocked: null };
  }

  async function eligibility(body, session) {
    const sku = readSku(body);
    if (!sku) return reply(400, { ok: false, error: "invalid_sku" });
    const [existing, orderId] = await Promise.all([
      db.getOwnReview(session.customer.id, sku),
      deliveredOrderId(session, sku),
    ]);
    return reply(200, {
      ok: true,
      canReview: Boolean(orderId),
      existingReview: toOwnReview(existing),
      ...(orderId ? {} : { reason: "not_delivered" }),
    });
  }

  async function upsert(body, session) {
    const sku = readSku(body);
    if (!sku) return reply(400, { ok: false, error: "invalid_sku" });
    const checked = validateReviewInput({ rating: body.rating, title: body.title, body: body.body });
    if (!checked.ok) return reply(400, { ok: false, error: checked.error });

    const gate = await writeGate(session);
    if (gate.blocked) return gate.blocked;

    const product = await db.getProduct(sku);
    if (!product) return reply(400, { ok: false, error: "unknown_product" });
    const orderId = await deliveredOrderId(session, sku);
    if (!orderId) return reply(403, { ok: false, error: "not_eligible" });

    const fields = {
      ...checked.value,
      order_id: orderId,          // server-chosen: the customer's delivered order
      status: "pending",          // every new review AND every edit
      admin_note: null,
      updated_at: new Date(now()).toISOString(),
    };
    const customerId = session.customer.id;
    let row;
    const existing = await db.getOwnReview(customerId, sku);
    if (existing) {
      row = await db.updateOwnReview(existing.id, customerId, fields);
    } else {
      try {
        row = await db.insertReview({ customer_id: customerId, product_sku: sku, ...fields });
      } catch (err) {
        // Double submit: the unique (product_sku, customer_id) row now exists.
        if (!/HTTP 409/.test(String(err?.message))) throw err;
        const again = await db.getOwnReview(customerId, sku);
        if (!again) throw err;
        row = await db.updateOwnReview(again.id, customerId, fields);
      }
    }
    return reply(200, { ok: true, review: toOwnReview(row) });
  }

  async function remove(body, session) {
    const sku = readSku(body);
    if (!sku) return reply(400, { ok: false, error: "invalid_sku" });
    const gate = await writeGate(session);
    if (gate.blocked) return gate.blocked;
    const deleted = await db.deleteOwnReview(session.customer.id, sku);
    if (!deleted) return reply(404, { ok: false, error: "not_found" });
    return reply(200, { ok: true, deleted: true });
  }

  async function myReviews(session) {
    const { customerId, phones } = owner(session);
    const [rows, delivered] = await Promise.all([
      db.listOwnReviews(customerId),
      db.listDeliveredOrders(customerId, phones),
    ]);
    const reviewed = new Set(rows.map((r) => r.product_sku));

    // Delivered products not reviewed yet, newest order first, one per SKU.
    const waiting = new Map();
    for (const o of delivered) {
      for (const it of o.order_items || []) {
        if (!it?.sku || reviewed.has(it.sku) || waiting.has(it.sku)) continue;
        waiting.set(it.sku, { sku: it.sku, name: it.product_name || it.sku, image: it.image || null, orderId: o.id, orderedAt: o.created_at });
      }
    }
    const skus = [...new Set([...reviewed, ...waiting.keys()])];
    const products = skus.length ? await db.getProducts(skus) : [];
    const bySku = new Map(products.map((p) => [p.sku, p]));

    const reviews = rows.map((r) => {
      const p = bySku.get(r.product_sku);
      return {
        ...toOwnReview(r),
        productName: p?.name || r.product_sku,
        productSlug: p?.slug || null,
        productImage: p?.image || null,
      };
    });
    const pendingToReview = [...waiting.values()].map((w) => {
      const p = bySku.get(w.sku);
      return { ...w, name: p?.name || w.name, image: p?.image || w.image, slug: p?.slug || null };
    });
    return reply(200, { ok: true, reviews, pendingToReview });
  }

  return {
    "review-eligibility": eligibility,
    "review-upsert": upsert,
    "review-delete": remove,
    "my-reviews": (_body, session) => myReviews(session),
  };
}
