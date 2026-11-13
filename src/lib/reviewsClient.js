import { supabase, supabaseConfigured } from "./supabaseClient.js";
import { callCustomerData } from "./customerOrdersClient.js";
import { REVIEW_ERROR_MESSAGES } from "./reviewRules.js";

/**
 * reviewsClient — storefront side of product reviews.
 *
 * Public (anyone): two RPCs that only ever return APPROVED reviews,
 * with the author shown as "First L." (no customer id or phone):
 *   product_reviews_public(sku, limit, offset, rating, sort)
 *   product_review_summary(sku)
 *
 * Signed-in customer: the customer-data function, which checks for a
 * delivered order containing the product, sets order_id and status
 * itself, and saves every new review / edit as "pending".
 *
 * Nothing here reads or writes the reviews, orders or order_items
 * tables directly (admin pages use reviewsAdmin.js).
 */

export const REVIEWS_PAGE_SIZE = 10;
export const REVIEW_SORTS = [
  { id: "newest",  label: "Newest" },
  { id: "highest", label: "Highest rating" },
  { id: "lowest",  label: "Lowest rating" },
];

const EMPTY_SUMMARY = { average: 0, total: 0, stars: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };

/* ============================================================
   Public reads
   ============================================================ */

/** { ok, summary:{ average, total, stars:{5..1} } } */
export async function fetchReviewSummary(sku) {
  if (!sku || !supabaseConfigured) return { ok: true, summary: EMPTY_SUMMARY };
  try {
    const { data, error } = await supabase.rpc("product_review_summary", { p_sku: sku });
    if (error) return { ok: false, error: error.message, summary: EMPTY_SUMMARY };
    const row = Array.isArray(data) ? data[0] : data;
    const stars = { ...EMPTY_SUMMARY.stars };
    for (const n of [1, 2, 3, 4, 5]) stars[n] = Number(row?.stars?.[n] ?? row?.stars?.[String(n)] ?? 0);
    return {
      ok: true,
      summary: { average: Number(row?.average) || 0, total: Number(row?.total) || 0, stars },
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), summary: EMPTY_SUMMARY };
  }
}

/** { ok, reviews:[{ id, rating, title, body, createdAt, author, verified }] } */
export async function fetchProductReviews(sku, { limit = REVIEWS_PAGE_SIZE, offset = 0, rating = null, sort = "newest" } = {}) {
  if (!sku || !supabaseConfigured) return { ok: true, reviews: [] };
  try {
    const { data, error } = await supabase.rpc("product_reviews_public", {
      p_sku: sku, p_limit: limit, p_offset: offset, p_rating: rating || null, p_sort: sort,
    });
    if (error) return { ok: false, error: error.message, reviews: [] };
    return {
      ok: true,
      reviews: (data || []).map((r) => ({
        id: r.id,
        rating: Number(r.rating) || 0,
        title: r.title || "",
        body: r.body || "",
        createdAt: r.created_at,
        author: r.author || "NAVEN customer",
        verified: Boolean(r.verified),
      })),
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), reviews: [] };
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
    error: REVIEW_ERROR_MESSAGES[code] || "Something went wrong. Please try again.",
  };
}

/** { ok, canReview, existingReview|null, reason? } */
export async function checkReviewEligibility(sku) {
  const { status, data } = await callCustomerData({ action: "review-eligibility", sku });
  if (status === 200 && data?.ok) {
    return { ok: true, canReview: Boolean(data.canReview), existingReview: data.existingReview || null, reason: data.reason || null };
  }
  return { ...failure(status, data), canReview: false, existingReview: null };
}

/** Saves the customer's review as pending. { ok, review } */
export async function upsertReview({ sku, rating, title, body }) {
  const { status, data } = await callCustomerData({
    action: "review-upsert", sku, rating: Number(rating), title: title || null, body: body || null,
  });
  if (status === 200 && data?.ok) return { ok: true, review: data.review };
  return failure(status, data);
}

export async function deleteReview(sku) {
  const { status, data } = await callCustomerData({ action: "review-delete", sku });
  if (status === 200 && data?.ok) return { ok: true };
  return failure(status, data);
}

/** { ok, reviews:[own, all statuses], pendingToReview:[delivered, not reviewed] } */
export async function fetchMyReviews() {
  const { status, data } = await callCustomerData({ action: "my-reviews" });
  if (status === 200 && data?.ok) {
    return { ok: true, reviews: data.reviews || [], pendingToReview: data.pendingToReview || [] };
  }
  return { ...failure(status, data), reviews: [], pendingToReview: [] };
}
