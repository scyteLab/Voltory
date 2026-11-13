import { normaliseNgPhone } from "../utils/phone.js";
import { listOrders as listLocalOrders, getOrder as getLocalOrder } from "../utils/orders.js";
import { getSessionToken } from "./customerAuth.js";

/**
 * customerOrdersClient
 *
 * Storefront order reads. They go through the customer-data Netlify
 * function (service role), never straight to Supabase, so the anon
 * key can lose read access to orders (lockdown plan, Phase 1).
 * Orders saved on this device (localStorage) are merged in, so a
 * guest's own orders still show while offline or before they sync.
 *
 * Public API:
 *   fetchCustomerOrders({ customerId, phone })
 *       signed-in customer's history (session token header)
 *   fetchOrderById(id, { phone })
 *       order confirmation page; the phone comes from the order saved
 *       on this device, or from the customer. Returns needsPhone when
 *       neither is available.
 *   fetchOrderByIdAndPhone({ orderId, phone, mode })
 *       guest lookup for the receipt ("order") and Track Order
 *       ("track", tracking fields only). Rate-limited on the server.
 */

const ENDPOINT = "/.netlify/functions/customer-data";

export const LOOKUP_MESSAGES = {
  notFound:    "We couldn't find an order with that ID and phone number.",
  rateLimited: "Too many attempts. Please try again in a few minutes.",
  failed:      "We couldn't look up that order right now. Please try again.",
};

/* ============================================================
   Transport
   ============================================================ */

/** POST to customer-data. Never throws: { status, data } (status 0 = offline / no function). */
async function callCustomerData(payload) {
  const headers = { "Content-Type": "application/json" };
  const token = getSessionToken();
  if (token) headers["X-Customer-Session"] = token;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => null);
    // A non-JSON answer means the function isn't there (e.g. plain
    // `vite` dev without `netlify dev`): treat like being offline.
    if (!data) return { status: 0, data: null };
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

function messageFor(status) {
  if (status === 404) return LOOKUP_MESSAGES.notFound;
  if (status === 429) return LOOKUP_MESSAGES.rateLimited;
  return LOOKUP_MESSAGES.failed;
}

/* ============================================================
   Helpers
   ============================================================ */

function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/[^\d]/g, "");
  // Canonical "08012345678" via utils/phone.js; values that aren't
  // valid Nigerian mobiles fall back to bare digits.
  return normaliseNgPhone(phone) || digits;
}

const normalizeOrderId = (id) => (id ? String(id).trim().toUpperCase() : "");
const phonesMatch = (a, b) => normalizePhone(a) === normalizePhone(b);

/** Server copy wins on shared fields; keeps the local sync stamp. */
function mergeOne(local, remote) {
  if (!local) return remote;
  const merged = { ...local, ...remote, syncedAt: local.syncedAt || remote.syncedAt };
  // A tracking-only answer has no name/street: keep this device's copy.
  if (remote.trackingOnly) {
    merged.contact = local.contact;
    merged.address = local.address;
    delete merged.trackingOnly;
  }
  return merged;
}

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
   My Orders
   ============================================================ */

export async function fetchCustomerOrders({ customerId, phone: rawPhone }) {
  const phone = rawPhone ? normalizePhone(rawPhone) : "";
  const local = listLocalOrders().filter(
    (o) => !phone || normalizePhone(o.contact?.phone) === phone
        || (o.customer_id && o.customer_id === customerId)
  );

  if (!customerId && !phone) return { orders: local, error: null, source: "local" };

  const { status, data } = await callCustomerData({ action: "orders" });
  if (status === 200 && Array.isArray(data?.orders)) {
    const merged = mergeOrders(data.orders, local);
    return { orders: merged, error: null, source: data.orders.length ? "supabase" : "local" };
  }
  if (status === 0 || status === 401) return { orders: local, error: null, source: "local" };
  return { orders: local, error: LOOKUP_MESSAGES.failed, source: "local" };
}

/* ============================================================
   Order confirmation page
   ============================================================ */

/**
 * { order, error, source, status, needsPhone }
 * needsPhone: the order isn't on this device and no phone was given
 * (or the given one didn't match): ask the customer for it.
 */
export async function fetchOrderById(id, { phone } = {}) {
  const cleanId = normalizeOrderId(id);
  if (!cleanId) return { order: null, error: "No order id", source: null, status: 400 };

  const local = getLocalOrder(id) || getLocalOrder(cleanId);
  const usePhone = phone || local?.contact?.phone || "";

  if (!usePhone && !getSessionToken()) {
    return { order: local, error: null, source: local ? "local" : null, needsPhone: !local };
  }

  const { status, data } = await callCustomerData({ action: "order", id: cleanId, phone: usePhone || undefined });
  if (status === 200 && data?.order) {
    return { order: mergeOne(local, data.order), error: null, source: "supabase", status };
  }
  if (local) return { order: local, error: null, source: "local", status };
  return {
    order: null,
    error: status === 0 ? LOOKUP_MESSAGES.failed : messageFor(status),
    source: null,
    status,
    needsPhone: status !== 429,
  };
}

/* ============================================================
   Receipt + Track Order (guest lookup)
   ============================================================ */

/**
 * Requires order id + phone. mode "order" returns the full order
 * (receipt); mode "track" returns tracking fields only.
 * Returns { order, error, source, status }.
 */
export async function fetchOrderByIdAndPhone({ orderId, phone, mode = "order" }) {
  const cleanId    = normalizeOrderId(orderId);
  const cleanPhone = normalizePhone(phone);

  if (!cleanId) return { order: null, error: "Please enter your order number.", source: null, status: 400 };
  if (!cleanPhone) return { order: null, error: "Please enter your phone number.", source: null, status: 400 };

  // Placed on this device with the same phone: show it even if the
  // server can't be reached, refreshed from the server when it can.
  const local = getLocalOrder(cleanId);
  const localMatch = local && phonesMatch(local.contact?.phone, cleanPhone) ? local : null;

  const { status, data } = await callCustomerData({
    action: mode === "track" ? "track" : "order",
    id: cleanId,
    phone: cleanPhone,
  });

  if (status === 200 && data?.order) {
    return { order: mergeOne(localMatch, data.order), error: null, source: "supabase", status };
  }
  if (localMatch) return { order: localMatch, error: null, source: "local", status };
  return { order: null, error: messageFor(status), source: null, status };
}
