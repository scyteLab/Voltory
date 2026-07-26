/**
 * Orders \u2014 created at checkout, persisted to localStorage as a
 * write-through cache in front of Supabase.
 *
 * Sync model:
 *   \u00B7 saveOrder() writes to localStorage synchronously so the
 *     confirmation page renders immediately.
 *   \u00B7 A background sweeper (see lib/ordersClient.js) tries to
 *     insert into Supabase. On success, it flips syncedAt on the
 *     local record via markOrderSynced().
 *   \u00B7 Orders without syncedAt are surfaced by getUnsyncedOrders()
 *     and retried by the sweeper at app boot and after each order.
 *
 * Order shape (unchanged; syncedAt is new):
 *   { id, createdAt, status, items: [{sku, qty, price, name}],
 *     contact, address, payment, totals, account, syncedAt? }
 */
const KEY = "voltory_orders";

/** VLT-YYYYMMDDHHmm-XXXX */
export function generateOrderId() {
  const d = new Date();
  const ts =
    d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0") +
    String(d.getHours()).padStart(2, "0") +
    String(d.getMinutes()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VLT-${ts}-${suffix}`;
}

export function listOrders() {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/**
 * Persist an order. Idempotent on `id` \u2014 if we're saving an order
 * with an id that already exists, we replace it (useful for the
 * sweeper stamping syncedAt).
 */
export function saveOrder(order) {
  try {
    const all = listOrders();
    const filtered = all.filter((o) => o.id !== order.id);
    localStorage.setItem(KEY, JSON.stringify([order, ...filtered]));
  } catch {
    /* noop */
  }
}

export function getOrder(id) {
  return listOrders().find((o) => o.id === id) || null;
}

/**
 * Sync helpers used by lib/ordersClient.js sweeper.
 */
export function getUnsyncedOrders() {
  return listOrders().filter((o) => !o.syncedAt);
}

export function markOrderSynced(id) {
  try {
    const all = listOrders();
    const next = all.map((o) =>
      o.id === id ? { ...o, syncedAt: new Date().toISOString() } : o
    );
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

/**
 * Status enum. Reconciled with the admin's `orders.status` CHECK
 * constraint:
 *   confirmed \u2192 processing \u2192 shipped \u2192 delivered
 *                                       \u2198 refunded
 *   any pre-shipped \u2192 cancelled
 *
 * `SHIPPED` is canonical. `OUT_FOR_DELIVERY` is exposed as an
 * alias so legacy imports keep compiling during migration \u2014 they
 * both point at the same string. Removed in Session 38.
 */
export const ORDER_STATUS = {
  CONFIRMED:  "confirmed",
  PROCESSING: "processing",
  SHIPPED:    "shipped",
  DELIVERED:  "delivered",
  CANCELLED:  "cancelled",
  REFUNDED:   "refunded",
  /** @deprecated Use SHIPPED. */
  OUT_FOR_DELIVERY: "shipped",
};

export const STATUS_FLOW = [
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
];

/**
 * Customer-facing labels. We deliberately show "Out for Delivery"
 * rather than "Shipped" \u2014 in Nigerian appliance retail context
 * "out for delivery" reads as the truck-is-coming milestone, which
 * is what customers care about.
 */
export const STATUS_LABEL = {
  [ORDER_STATUS.CONFIRMED]:  "Order Confirmed",
  [ORDER_STATUS.PROCESSING]: "Processing",
  [ORDER_STATUS.SHIPPED]:    "Out for Delivery",
  [ORDER_STATUS.DELIVERED]:  "Delivered",
  [ORDER_STATUS.CANCELLED]:  "Cancelled",
  [ORDER_STATUS.REFUNDED]:   "Refunded",
};