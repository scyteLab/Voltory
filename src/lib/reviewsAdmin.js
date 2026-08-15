import { supabase } from "./supabaseClient.js";

/**
 * reviewsAdmin — the admin side of reviews.
 *
 * Reads every review regardless of status, joins customer name +
 * product name for the queue display, and provides approve/reject/
 * delete mutations. Approve sets status='approved' and the
 * products.rating trigger recomputes the aggregate automatically.
 */

/**
 * Fetch reviews for the admin queue, optionally filtered by status.
 * Sorted by most-recent-first so pending items surface at the top.
 * Joins the product name/SKU/image and the customer name/phone.
 */
export async function fetchReviewsForAdmin({ status = "pending", limit = 100 } = {}) {
  try {
    let query = supabase
      .from("reviews")
      .select(`
        *,
        products ( sku, name, slug, image ),
        customers ( id, name, phone )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[reviewsAdmin] fetch failed:", error);
      return { ok: false, error: error.message, reviews: [] };
    }

    const reviews = (data || []).map((r) => ({
      id: r.id,
      productSku:  r.product_sku,
      productName: r.products?.name  || r.product_sku,
      productSlug: r.products?.slug  || null,
      productImage: r.products?.image || null,
      customerId:   r.customer_id,
      customerName: r.customers?.name  || "NAVEN customer",
      customerPhone: r.customers?.phone || "",
      orderId:      r.order_id,
      verifiedBuyer: !!r.order_id,
      rating:       r.rating,
      title:        r.title,
      body:         r.body,
      status:       r.status,
      adminNote:    r.admin_note,
      createdAt:    r.created_at,
      updatedAt:    r.updated_at,
    }));

    return { ok: true, reviews };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), reviews: [] };
  }
}

/**
 * Count reviews per status. Used to render the tab badges
 * (Pending 5 | Approved 42 | Rejected 3).
 */
export async function fetchReviewStatusCounts() {
  try {
    const [p, a, r] = await Promise.all([
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("reviews").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    ]);
    return {
      ok: true,
      counts: {
        pending:  p.count || 0,
        approved: a.count || 0,
        rejected: r.count || 0,
      },
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), counts: {} };
  }
}

/**
 * Set a review's status. Approving clears any admin_note; rejecting
 * writes the note through. Rejection with no reason is allowed but
 * discouraged.
 *
 * The reviews_recompute trigger fires on this update and updates
 * products.rating + products.reviews automatically.
 */
export async function setReviewStatus(id, status, adminNote = null) {
  if (!id) return { ok: false, error: "Missing review id" };
  if (!["pending", "approved", "rejected"].includes(status)) {
    return { ok: false, error: "Invalid status" };
  }
  try {
    const patch = { status };
    if (status === "rejected") patch.admin_note = adminNote?.trim() || null;
    if (status === "approved") patch.admin_note = null;

    const { data, error } = await supabase
      .from("reviews")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[reviewsAdmin] setStatus failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, review: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Hard delete — for spam / abusive reviews we don't want kept
 * even in the rejected pile. Use sparingly. The recompute trigger
 * fires on delete too.
 */
export async function deleteReviewAsAdmin(id) {
  if (!id) return { ok: false, error: "Missing review id" };
  try {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}