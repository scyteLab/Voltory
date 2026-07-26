import { supabase, supabaseConfigured } from "./supabaseClient.js";

/**
 * ordersClient
 *
 * Owns the wire-format translation between the storefront's local
 * order shape and the admin's Supabase schema. Also owns the
 * background retry sweeper for orders that failed to sync at
 * checkout (customer was offline, RLS blip, whatever).
 *
 * Design contract:
 *   \u00B7 The storefront never blocks the customer on Supabase. Cart
 *     clears immediately after localStorage write.
 *   \u00B7 A failed sync is silent to the customer; retry happens later.
 *   \u00B7 Once synced, we mark the local record with `syncedAt` \u2014 the
 *     sweeper skips already-synced orders on subsequent runs.
 *
 * Status enum reconciliation:
 *   Storefront historically wrote status="out_for_delivery" for the
 *   stage between processing and delivered. Admin schema and CHECK
 *   constraint call it "shipped". We treat "shipped" as canonical
 *   \u2014 that's the wire value \u2014 and the storefront's STATUS_LABEL
 *   maps it back to "Out for Delivery" for the customer view.
 */

/**
 * Translate a storefront order object into the flat rows that go
 * into `orders` and `order_items`. Storefront shape:
 *   { id, createdAt, status, items:[{sku, qty, price, name, image}],
 *     contact:{name,phone,email}, address:{...},
 *     payment:{ method, ... }, installation:bool,
 *     totals:{ subtotal, discount, deliveryFee, installationFee, grand },
 *     account:{phone,name}, accountCreated }
 *
 * Supabase shape (from supabase/orders_and_warranty.sql):
 *   orders(id text pk, created_at, customer_name, customer_phone,
 *          customer_email, address jsonb, payment_method enum,
 *          status enum, subtotal, discount, delivery_fee,
 *          installation_fee, total, notes)
 *   order_items(order_id, sku, qty, unit_price, line_total, product_name)
 */
function toSupabaseShape(order) {
  const paymentMethod = mapPaymentMethod(order.payment?.method);
  const orderRow = {
    id: order.id,
    created_at: order.createdAt,
    customer_name:  order.contact?.name  || order.account?.name  || "",
    customer_phone: order.contact?.phone || order.account?.phone || "",
    customer_email: order.contact?.email || null,
    address: order.address || {},
    payment_method: paymentMethod,
    status: normaliseOutgoingStatus(order.status),
    subtotal:         Math.round(order.totals?.subtotal      ?? 0),
    discount:         Math.round(order.totals?.discount      ?? 0),
    delivery_fee:     Math.round(order.totals?.deliveryFee   ?? 0),
    installation_fee: Math.round(order.totals?.installationFee ?? 0),
    total:            Math.round(order.totals?.grand         ?? 0),
    notes: order.notes || null,
  };
  const itemRows = (order.items || []).map((i) => ({
    order_id: order.id,
    sku: i.sku,
    qty: Number(i.qty) || 1,
    unit_price: Math.round(i.price || 0),
    line_total: Math.round((i.price || 0) * (i.qty || 1)),
    product_name: i.name || i.sku,
  }));
  return { orderRow, itemRows };
}

/**
 * Map storefront payment.method values to the admin enum.
 * Storefront currently emits: "card" | "transfer" | "pod" | "ussd"
 * Admin enum accepts the same set. We defensively coerce anything
 * unknown to "transfer" \u2014 the safest default.
 */
function mapPaymentMethod(m) {
  const allowed = new Set(["card", "transfer", "pod", "ussd"]);
  return allowed.has(m) ? m : "transfer";
}

/**
 * Storefront's legacy "out_for_delivery" \u2192 admin's "shipped".
 * Anything else passes through if it's a valid admin status.
 */
function normaliseOutgoingStatus(s) {
  if (s === "out_for_delivery") return "shipped";
  const valid = new Set(["confirmed","processing","shipped","delivered","cancelled","refunded"]);
  return valid.has(s) ? s : "confirmed";
}

/**
 * Insert an order + its items into Supabase. Returns { ok: true }
 * on success or { ok: false, error } on any failure. Never throws.
 * We swallow because callers are in a background retry loop and
 * we don't want a rejection cascade.
 */
export async function insertOrderToSupabase(order) {
  if (!supabaseConfigured) {
    return { ok: false, error: "Supabase not configured" };
  }
  try {
    const { orderRow, itemRows } = toSupabaseShape(order);

    // Insert the order first \u2014 order_items has an FK to orders.id.
    // Use upsert on id so retries after a partial success don't blow up.
    const orderRes = await supabase
      .from("orders")
      .upsert(orderRow, { onConflict: "id" });
    if (orderRes.error) throw orderRes.error;

    if (itemRows.length) {
      const itemsRes = await supabase
        .from("order_items")
        .upsert(itemRows, { onConflict: "order_id,sku" });
      if (itemsRes.error) throw itemsRes.error;
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Background retry sweep. Called on app boot and after every checkout.
 * Walks the local orders list, retries any order without `syncedAt`,
 * and updates the local record on success. Bounded to a handful per
 * sweep to keep it polite \u2014 unlikely to have huge backlogs anyway.
 *
 * markSyncedFn(orderId) is passed in so we don't have to import from
 * utils/orders.js here (avoids circular dep since utils/orders.js will
 * import from this file).
 */
export async function sweepUnsyncedOrders({ getUnsynced, markSynced, max = 10 }) {
  if (!supabaseConfigured) return { attempted: 0, ok: 0 };
  const pending = (getUnsynced() || []).slice(0, max);
  let ok = 0;
  for (const order of pending) {
    const res = await insertOrderToSupabase(order);
    if (res.ok) {
      markSynced(order.id);
      ok += 1;
    }
  }
  return { attempted: pending.length, ok };
}