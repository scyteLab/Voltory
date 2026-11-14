import { supabase } from "./supabaseClient.js";
import { validateAnswer } from "./questionRules.js";

/**
 * questionsAdmin — Admin → Questions.
 *
 * Staff read and change product_questions directly (Supabase Auth +
 * RLS: public.is_admin()). The database stamps answered_by /
 * answered_at itself and keeps products.questions current; the
 * notify-event webhook emails the customer once when a question is
 * first published with an answer.
 */

const SELECT = `*, products ( sku, name, slug, image ), customers ( id, name, phone )`;

function shape(r) {
  return {
    id: r.id,
    productSku: r.product_sku,
    productName: r.products?.name || r.product_sku,
    productSlug: r.products?.slug || null,
    productImage: r.products?.image || null,
    customerId: r.customer_id,
    customerName: r.customers?.name || "NAVEN customer",
    customerPhone: r.customers?.phone || "",
    question: r.question,
    status: r.status,
    answer: r.answer || "",
    answeredAt: r.answered_at,
    adminNote: r.admin_note || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const errText = (e) => e?.message || String(e);

export async function fetchQuestionsForAdmin({ status = "pending", limit = 200 } = {}) {
  try {
    let q = supabase.from("product_questions").select(SELECT).order("created_at", { ascending: false }).limit(limit);
    if (status && status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message, questions: [] };
    return { ok: true, questions: (data || []).map(shape) };
  } catch (err) {
    return { ok: false, error: errText(err), questions: [] };
  }
}

export async function fetchQuestionStatusCounts() {
  try {
    const count = (status) => supabase.from("product_questions").select("id", { count: "exact", head: true }).eq("status", status);
    const [p, pub, r] = await Promise.all([count("pending"), count("published"), count("rejected")]);
    const failed = [p, pub, r].find((x) => x.error);
    if (failed) return { ok: false, error: failed.error.message, counts: { pending: 0, published: 0, rejected: 0 } };
    return { ok: true, counts: { pending: p.count || 0, published: pub.count || 0, rejected: r.count || 0 } };
  } catch (err) {
    return { ok: false, error: errText(err), counts: { pending: 0, published: 0, rejected: 0 } };
  }
}

async function patch(id, fields) {
  if (!id) return { ok: false, error: "Missing question id" };
  try {
    const { data, error } = await supabase.from("product_questions").update(fields).eq("id", id).select(SELECT).single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, question: shape(data) };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}

/** Save the answer and publish (also used to edit a published answer). */
export function answerQuestion(id, answer) {
  const checked = validateAnswer(answer);
  if (!checked.ok) return Promise.resolve(checked);
  return patch(id, { answer: checked.value, status: "published", admin_note: null });
}

export function rejectQuestion(id, note) {
  return patch(id, { status: "rejected", admin_note: String(note || "").trim() || null });
}

export function moveQuestionToPending(id) {
  return patch(id, { status: "pending", admin_note: null });
}

export async function deleteQuestionAsAdmin(id) {
  if (!id) return { ok: false, error: "Missing question id" };
  try {
    const { error } = await supabase.from("product_questions").delete().eq("id", id);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (err) {
    return { ok: false, error: errText(err) };
  }
}
