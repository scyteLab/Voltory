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
 *
 * Public API:
 *   fetchCustomerOrders({ customerId, phone })
 *       \u2014 signed-in customer's full history
 *   fetchOrderById(id)
 *       \u2014 lookup by id alone (used by OrderConfirmation right
 *         after checkout, where re-verification would be silly)
 *   fetchOrderByIdAndPhone({ orderId, phone })
 *       \u2014 GUEST TRACKING: requires both, rate-limited. Used by
 *         the public /track-order page.
 */

/* ============================================================
   Shape adapter: Supabase row \u2192 storefront order shape
   ============================================================ */

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
    syncedAt: row.created_at,
  };
}

/* ============================================================
   Merge helper (unchanged)
   ============================================================ */

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
   Existing: fetchCustomerOrders (UNCHANGED)
   ============================================================ */

export async function fetchCustomerOrders({ customerId, phone }) {
  const localPhone = phone || "";
  const local = listLocalOrders().filter(
    (o) => !localPhone || (o.contact?.phone || "").replace(/\s/g, "") === localPhone.replace(/\s/g, "")
        || (o.customer_id && o.customer_id === customerId)
  );

  if (!supabaseConfigured) return { orders: local, error: null, source: "local" };

  try {
    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false });

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

/* ============================================================
   Existing: fetchOrderById (UNCHANGED)
   Used by OrderConfirmation right after checkout \u2014 no phone
   re-verification needed in that context.
   ============================================================ */

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

/* ============================================================
   NEW: fetchOrderByIdAndPhone \u2014 guest tracking with rate limit
   ============================================================
   Used by the public /track-order page. Requires BOTH order id
   and phone to succeed. Rate-limited per client to prevent
   enumeration.

   Local-first strategy is preserved: if the order is in the
   caller's localStorage (they placed it on this device), we
   still confirm the phone matches before returning it. That way
   the security bar is the same whether the data comes from
   local or remote.
*/

const MAX_ATTEMPTS_PER_HOUR = 10;

function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/[^\d]/g, "");
  if (digits.startsWith("234") && digits.length === 13) return "0" + digits.slice(3);
  if (digits.startsWith("0")   && digits.length === 11) return digits;
  if (digits.length === 10 && /^[7-9]/.test(digits))    return "0" + digits;
  return digits;
}

function normalizeOrderId(id) {
  if (!id) return "";
  return String(id).trim().toUpperCase();
}

/**
 * Best-effort client identifier for rate limiting. Tries public
 * IP first, falls back to a stable browser fingerprint hash.
 */
async function getClientId() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data?.ip) return data.ip;
  } catch { /* fall through */ }

  const raw = [
    typeof navigator !== "undefined" ? navigator.userAgent : "",
    typeof navigator !== "undefined" ? navigator.language : "",
    typeof screen !== "undefined" ? screen.width : 0,
    typeof screen !== "undefined" ? screen.height : 0,
    new Date().getTimezoneOffset(),
  ].join("|");

  try {
    const enc = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return "fp:" + Array.from(new Uint8Array(buf))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "fp:unknown";
  }
}

function logAttempt(clientId, success) {
  if (!supabaseConfigured) return;
  supabase
    .from("order_tracking_attempts")
    .insert({ ip_address: clientId, success })
    .then(() => {}, () => {});
}

async function checkRateLimit(clientId) {
  if (!supabaseConfigured) return { limited: false };
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const { count } = await supabase
      .from("order_tracking_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", clientId)
      .gt("created_at", cutoff);

    if (count != null && count >= MAX_ATTEMPTS_PER_HOUR) {
      return { limited: true };
    }
    return { limited: false };
  } catch {
    return { limited: false }; // fail open
  }
}

function phonesMatch(a, b) {
  return normalizePhone(a) === normalizePhone(b);
}

/**
 * Guest order lookup. Requires (orderId + phone) to succeed.
 * Rate-limited per client. Returns generic error messages so
 * attackers can't distinguish "wrong phone" from "wrong id".
 *
 * Return shape mirrors fetchOrderById:
 *   { order: {...} | null, error: string | null, source: "supabase" | "local" | null }
 */
export async function fetchOrderByIdAndPhone({ orderId, phone }) {
  const cleanId    = normalizeOrderId(orderId);
  const cleanPhone = normalizePhone(phone);

  if (!cleanId) return { order: null, error: "Please enter your order number.", source: null };
  if (!cleanPhone) return { order: null, error: "Please enter your phone number.", source: null };

  const clientId = await getClientId();

  /* Rate-limit check */
  const rate = await checkRateLimit(clientId);
  if (rate.limited) {
    return {
      order: null,
      error: "Too many lookup attempts. Please try again in about an hour.",
      source: null,
    };
  }

  /* Local check first \u2014 verify phone matches the stored order */
  const local = getLocalOrder(cleanId);
  if (local && phonesMatch(local.contact?.phone, cleanPhone)) {
    /* Still try remote for freshest status \u2014 but don't block */
    if (supabaseConfigured) {
      try {
        const { data } = await supabase
          .from("orders")
          .select("*, order_items(*)")
          .eq("id", cleanId)
          .eq("customer_phone", cleanPhone)
          .maybeSingle();
        if (data) {
          logAttempt(clientId, true);
          const remote = toStorefrontShape(data);
          return {
            order: { ...local, ...remote, syncedAt: local.syncedAt || remote.syncedAt },
            error: null,
            source: "supabase",
          };
        }
      } catch { /* fall back to local */ }
    }
    logAttempt(clientId, true);
    return { order: local, error: null, source: "local" };
  }

  /* No local match \u2014 must query Supabase */
  if (!supabaseConfigured) {
    logAttempt(clientId, false);
    return {
      order: null,
      error: "No order found with that order number and phone. Please check both and try again.",
      source: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", cleanId)
      .eq("customer_phone", cleanPhone)
      .maybeSingle();

    if (error) {
      logAttempt(clientId, false);
      return { order: null, error: "Couldn't look up that order. Please try again.", source: null };
    }
    if (!data) {
      logAttempt(clientId, false);
      return {
        order: null,
        error: "No order found with that order number and phone. Please check both and try again.",
        source: null,
      };
    }

    logAttempt(clientId, true);
    return { order: toStorefrontShape(data), error: null, source: "supabase" };
  } catch (err) {
    logAttempt(clientId, false);
    return { order: null, error: err?.message || "Something went wrong. Please try again.", source: null };
  }
}