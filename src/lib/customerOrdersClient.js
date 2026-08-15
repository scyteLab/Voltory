import { supabase, supabaseConfigured } from "./supabaseClient.js";
import { listOrders as listLocalOrders, getOrder as getLocalOrder } from "../utils/orders.js";

/**
 * customerOrdersClient
 *
 * Reads orders from Supabase (source of truth) with a graceful
 * merge into localStorage-only orders.
 *
 * Why merge, not replace:
 *   - A customer might have placed orders as a guest BEFORE
 *     Supabase went online, or before customer_id linking landed.
 *     Those live only in localStorage on the device that placed
 *     them. Discarding them would look like data loss to the
 *     customer.
 *   - Supabase is the source of truth on any id that appears in
 *     both places (the admin may have updated status server-side).
 */

/* ============================================================
   Shape adapter: Supabase row → storefront order shape
   ============================================================ */

/**
 * Turn a Supabase orders row (with its order_items joined) back
 * into the storefront's nested shape. Every page consuming orders
 * expects this shape, so we absorb the difference here rather than
 * touching every consumer.
 */
function toStorefrontShape(row) {
  if (!row) return null;
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    items: items.map((i) => ({
      sku: i.sku,
      qty: i.qty,
      price: i.unit_price,
      name: i.product_name,
      image: i.image || null,
    })),
    contact: {
      name:  row.customer_name  || "",
      phone: row.customer_phone || "",
      email: row.customer_email || "",
    },
    address: row.address || {},
    payment: { method: row.payment_method },
    installation: (row.installation_fee || 0) > 0,
    totals: {
      subtotal:        row.subtotal || 0,
      discount:        row.discount || 0,
      deliveryFee:     row.delivery_fee || 0,
      installationFee: row.installation_fee || 0,
      grand:           row.total || 0,
    },
    account: { phone: row.customer_phone, name: row.customer_name },
    accountCreated: false,
    customer_id: row.customer_id || null,
    syncedAt: row.created_at, // if it came from Supabase, it's synced
  };
}

/* ============================================================
   Merge helper
   ============================================================ */

/**
 * Given remote orders (from Supabase) and local orders (from
 * localStorage), produce the customer-facing list:
 *   · Deduped by id
 *   · Supabase wins on any overlap (its status is fresher)
 *   · Local-only orders are included after remote ones
 *   · Sorted by createdAt desc
 */
function mergeOrders(remoteList, localList) {
  const byId = new Map();
  for (const r of remoteList || []) byId.set(r.id, r);
  for (const l of localList || []) {
    if (!byId.has(l.id)) byId.set(l.id, l);
  }
  return [...byId.values()].sort((a, b) => {
    const ad = new Date(a.createdAt || 0).getTime();
    const bd = new Date(b.createdAt || 0).getTime();
    return bd - ad;
  });
}

/* ============================================================
   Public API
   ============================================================ */

/**
 * Fetch every order belonging to a customer.
 *
 * We match on customer_id first (the clean linkage established at
 * checkout via upsertFromCheckout). We also match on customer_phone
 * as a fallback — legacy orders (before customer_id was populated)
 * still work.
 *
 * Returns the merged storefront-shape list. Never throws; on any
 * Supabase failure returns localStorage-filtered orders so the page
 * still shows something honest.
 */
export async function fetchCustomerOrders({ customerId, phone }) {
  const localPhone = phone || "";
  const local = listLocalOrders().filter(
    (o) => !localPhone || (o.contact?.phone || "").replace(/\s/g, "") === localPhone.replace(/\s/g, "")
        || (o.customer_id && o.customer_id === customerId)
  );

  if (!supabaseConfigured) return { orders: local, error: null, source: "local" };

  try {
    // Build the .or() clause safely — both filters as fallback for
    // legacy orders (no customer_id) and clean links (customer_id set).
    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

    // If we have both, use OR. Otherwise pick whichever is available.
    if (customerId && phone) {
      query = query.or(`customer_id.eq.${customerId},customer_phone.eq.${phone}`);
    } else if (customerId) {
      query = query.eq("customer_id", customerId);
    } else if (phone) {
      query = query.eq("customer_phone", phone);
    } else {
      return { orders: local, error: null, source: "local" };
    }

    const { data, error } = await query;
    if (error) return { orders: local, error: error.message, source: "local" };

    const remote = (data || []).map(toStorefrontShape).filter(Boolean);
    const merged = mergeOrders(remote, local);
    return { orders: merged, error: null, source: remote.length ? "supabase" : "local" };
  } catch (err) {
    return { orders: local, error: err?.message || String(err), source: "local" };
  }
}

/**
 * Fetch one order by id. Used by OrderConfirmation and TrackOrder.
 * Falls back to localStorage on any Supabase miss/failure —
 * important for the confirmation page immediately after checkout
 * (Supabase sync may not have completed yet).
 */
export async function fetchOrderById(id) {
  if (!id) return { order: null, error: "No order id", source: null };

  const local = getLocalOrder(id);

  if (!supabaseConfigured) return { order: local, error: null, source: local ? "local" : null };

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .maybeSingle();

    if (error) return { order: local, error: error.message, source: local ? "local" : null };
    if (!data)  return { order: local, error: null,         source: local ? "local" : null };

    const remote = toStorefrontShape(data);
    // If we have both, remote wins for status (admin may have updated)
    // but preserve any local-only fields we care about (syncedAt).
    if (local) {
      return {
        order: { ...local, ...remote, syncedAt: local.syncedAt || remote.syncedAt },
        error: null,
        source: "supabase",
      };
    }
    return { order: remote, error: null, source: "supabase" };
  } catch (err) {
    return { order: local, error: err?.message || String(err), source: local ? "local" : null };
  }
}