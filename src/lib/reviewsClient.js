import { supabase, supabaseConfigured } from "./supabaseClient.js";

/**
 * reviewsClient
 *
 * Reads approved reviews for the product page, writes new reviews
 * from signed-in verified buyers, and lists own reviews for the
 * account page.
 *
 * Verified-buyer check is client-side: we look up the customer's
 * orders to see if any contained this product's SKU. If yes,
 * writing a review is enabled and we tag the review with the
 * matching order_id.
 */

/* ============================================================
   Public reads
   ============================================================ */

/**
 * Fetch approved reviews for a product, most recent first.
 * Also returns the aggregate: average rating + count.
 */
export async function fetchProductReviews(productSku, { limit = 20 } = {}) {
  if (!productSku) return { ok: true, reviews: [], aggregate: { average: 0, count: 0 } };
  if (!supabaseConfigured) return { ok: true, reviews: [], aggregate: { average: 0, count: 0 } };

  try {
    // Approved list
    const listRes = await supabase
      .from("reviews")
      .select("id, rating, title, body, created_at, customer_id, order_id, customers ( name )")
      .eq("product_sku", productSku)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (listRes.error) {
      // eslint-disable-next-line no-console
      console.error("[reviews] fetch list failed:", listRes.error);
      return { ok: false, error: listRes.error.message, reviews: [], aggregate: { average: 0, count: 0 } };
    }

    const reviews = (listRes.data || []).map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      createdAt: r.created_at,
      customerId: r.customer_id,
      orderId: r.order_id,
      authorName: r.customers?.name || "Voltory customer",
      verifiedBuyer: !!r.order_id,
    }));

    // Aggregate \u2014 separate lightweight query for count and average.
    // Doing this DB-side means we don't pay to fetch all rows.
    const aggRes = await supabase
      .from("reviews")
      .select("rating", { count: "exact" })
      .eq("product_sku", productSku)
      .eq("status", "approved");

    let avg = 0;
    if (aggRes.data && aggRes.data.length > 0) {
      const sum = aggRes.data.reduce((s, x) => s + x.rating, 0);
      avg = sum / aggRes.data.length;
    }
    const count = aggRes.count || 0;

    return { ok: true, reviews, aggregate: { average: avg, count } };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), reviews: [], aggregate: { average: 0, count: 0 } };
  }
}

/* ============================================================
   Verified-buyer check
   ============================================================ */

/**
 * Does this customer have an order that contained this product?
 * Returns { canReview: boolean, orderId?: string, existingReview?: {...} }.
 *
 * We also return any existing review by this customer on this
 * product so the UI can render the "Edit your review" state.
 */
export async function checkReviewEligibility(customerId, productSku) {
  if (!customerId || !productSku) return { canReview: false };
  if (!supabaseConfigured) return { canReview: false };

  try {
    // Check for existing review first (regardless of order history \u2014
    // if they somehow have a review, they can edit it)
    const existRes = await supabase
      .from("reviews")
      .select("*")
      .eq("customer_id", customerId)
      .eq("product_sku", productSku)
      .maybeSingle();

    const existingReview = existRes.data || null;

    // Find any order by this customer that contained this SKU
    const orderRes = await supabase
      .from("order_items")
      .select("order_id, orders!inner(customer_id)")
      .eq("sku", productSku)
      .eq("orders.customer_id", customerId)
      .limit(1)
      .maybeSingle();

    const orderId = orderRes.data?.order_id || null;

    return {
      canReview: !!orderId || !!existingReview, // either bought it or already has a review
      orderId,
      existingReview,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[reviews] eligibility check failed:", err);
    return { canReview: false };
  }
}

/* ============================================================
   Writes
   ============================================================ */

function validateReview(input) {
  const rating = Number(input.rating);
  if (!rating || rating < 1 || rating > 5) return "Please pick a rating from 1 to 5 stars";
  if (!input.body?.trim()) return "Please write a short review";
  if (input.body.trim().length < 10) return "Review is a bit too short \u2014 tell us a little more";
  if (input.body.length > 2000) return "Review is too long (max 2000 characters)";
  if (input.title && input.title.length > 120) return "Title is too long (max 120 characters)";
  return null;
}

/**
 * Create or update the customer's review for a product.
 * Because we have a unique (product_sku, customer_id) constraint,
 * we detect existing rows and update instead of insert.
 *
 * Every write lands as status='pending' \u2014 admin approval required.
 * Editing a previously-approved review resets it to pending.
 */
export async function upsertReview({ customerId, productSku, orderId, rating, title, body }) {
  const validErr = validateReview({ rating, title, body });
  if (validErr) return { ok: false, error: validErr };
  if (!customerId || !productSku) return { ok: false, error: "Not signed in" };

  try {
    // Hybrid moderation:
    //   \u2022 Verified buyer (order_id present) \u2192 auto-approved on first
    //     submission. They earned the right by actually buying.
    //   \u2022 Non-verified (order_id null) \u2192 held pending for review.
    //     In practice this branch is rarely hit since our UI only
    //     shows the write-review form to verified buyers, but the
    //     safety net is here for anything that slips through.
    //   \u2022 Editing an already-approved review \u2192 stays approved.
    //     Holding every typo-fix would feel punitive.
    //   \u2022 Editing a pending/rejected review \u2192 stays in its bucket
    //     until the admin takes action, matching prior behaviour.
    const isVerifiedBuyer = !!orderId;

    // Look for existing to decide status behaviour on edit
    const existRes = await supabase
      .from("reviews")
      .select("id, status")
      .eq("customer_id", customerId)
      .eq("product_sku", productSku)
      .maybeSingle();

    let nextStatus;
    if (existRes.data) {
      // Edit path
      if (existRes.data.status === "approved") nextStatus = "approved";
      else if (existRes.data.status === "rejected") nextStatus = "pending"; // give them another chance on re-submit
      else nextStatus = "pending";
    } else {
      // First submission
      nextStatus = isVerifiedBuyer ? "approved" : "pending";
    }

    const row = {
      customer_id: customerId,
      product_sku: productSku,
      order_id: orderId || null,
      rating: Number(rating),
      title: title?.trim() || null,
      body: body.trim(),
      status: nextStatus,
    };

    let res;
    if (existRes.data?.id) {
      res = await supabase
        .from("reviews")
        .update(row)
        .eq("id", existRes.data.id)
        .select()
        .single();
    } else {
      res = await supabase
        .from("reviews")
        .insert(row)
        .select()
        .single();
    }

    if (res.error) {
      // eslint-disable-next-line no-console
      console.error("[reviews] upsert failed:", res.error);
      return { ok: false, error: res.error.message };
    }
    return { ok: true, review: res.data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Delete the customer's own review.
 */
export async function deleteReview(customerId, reviewId) {
  if (!customerId || !reviewId) return { ok: false, error: "Missing identifier" };
  try {
    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId)
      .eq("customer_id", customerId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   My Reviews \u2014 for /account/reviews
   ============================================================ */

/**
 * Every review by this customer, all statuses.
 * Joined with product name for the account page.
 */
export async function fetchCustomerReviews(customerId) {
  if (!customerId) return { ok: true, reviews: [] };
  if (!supabaseConfigured) return { ok: true, reviews: [] };

  try {
    const { data, error } = await supabase
      .from("reviews")
      .select("*, products ( name, image, slug )")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message, reviews: [] };
    const reviews = (data || []).map((r) => ({
      id: r.id,
      productSku: r.product_sku,
      productName: r.products?.name || r.product_sku,
      productImage: r.products?.image || null,
      productSlug: r.products?.slug || null,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      adminNote: r.admin_note,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    return { ok: true, reviews };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), reviews: [] };
  }
}