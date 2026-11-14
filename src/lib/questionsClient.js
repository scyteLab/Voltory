import { supabase, supabaseConfigured } from "./supabaseClient.js";
import { callCustomerData } from "./customerOrdersClient.js";
import { QUESTION_ERROR_MESSAGES } from "./questionRules.js";

/**
 * questionsClient — storefront side of product Q&A.
 *
 * Public (anyone): RPCs that only return PUBLISHED + ANSWERED
 * questions, asker shown as "First L." (no customer id, phone, email):
 *   product_questions_public(sku, limit, offset, search)
 *   product_questions_count(sku)
 *
 * Signed-in customer: the customer-data function (ask, delete own
 * pending question, list own questions). Nothing here touches the
 * product_questions table directly (admin pages use questionsAdmin.js).
 */

export const QUESTIONS_PAGE_SIZE = 10;

/* ============================================================
   Public reads
   ============================================================ */

/** { ok, count } */
export async function fetchQuestionCount(sku) {
  if (!sku || !supabaseConfigured) return { ok: true, count: 0 };
  try {
    const { data, error } = await supabase.rpc("product_questions_count", { p_sku: sku });
    if (error) return { ok: false, error: error.message, count: 0 };
    return { ok: true, count: Number(Array.isArray(data) ? data[0] : data) || 0 };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), count: 0 };
  }
}

/**
 * { ok, questions:[{ id, question, answer, askedAt, answeredAt, author }], hasMore }
 * Asks for one extra row to know whether "Load more" is needed.
 */
export async function fetchProductQuestions(sku, { limit = QUESTIONS_PAGE_SIZE, offset = 0, search = "" } = {}) {
  if (!sku || !supabaseConfigured) return { ok: true, questions: [], hasMore: false };
  try {
    const { data, error } = await supabase.rpc("product_questions_public", {
      p_sku: sku, p_limit: limit + 1, p_offset: offset, p_search: search.trim() || null,
    });
    if (error) return { ok: false, error: error.message, questions: [], hasMore: false };
    const rows = data || [];
    return {
      ok: true,
      hasMore: rows.length > limit,
      questions: rows.slice(0, limit).map((q) => ({
        id: q.id,
        question: q.question || "",
        answer: q.answer || "",
        askedAt: q.asked_at,
        answeredAt: q.answered_at,
        author: q.author || "NAVEN customer",
      })),
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), questions: [], hasMore: false };
  }
}

/* ============================================================
   Signed-in customer (customer-data function)
   ============================================================ */

function failure(status, data) {
  const code = data?.error || (status === 0 ? "offline" : "server_error");
  return {
    ok: false,
    status,
    code,
    error: QUESTION_ERROR_MESSAGES[code] || "Something went wrong. Please try again.",
  };
}

/** Saves the question as pending. { ok, question } */
export async function askQuestion({ sku, question }) {
  const { status, data } = await callCustomerData({ action: "question-ask", sku, question });
  if (status === 200 && data?.ok) return { ok: true, question: data.question };
  return failure(status, data);
}

export async function deleteQuestion(id) {
  const { status, data } = await callCustomerData({ action: "question-delete", id });
  if (status === 200 && data?.ok) return { ok: true };
  return failure(status, data);
}

/** { ok, questions:[own, all statuses, with product name/slug/image] } */
export async function fetchMyQuestions() {
  const { status, data } = await callCustomerData({ action: "my-questions" });
  if (status === 200 && data?.ok) return { ok: true, questions: data.questions || [] };
  return { ...failure(status, data), questions: [] };
}
