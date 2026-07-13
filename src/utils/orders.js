/**
 * Orders — created at checkout, persisted to localStorage so the
 * confirmation page (and later /account/orders) can render them
 * across page refreshes. Replaced by the orders API when the
 * backend lands; the shape stays.
 *
 * Order shape:
 *   { id, createdAt, status, items: [{sku, qty, price, name}],
 *     contact, address, payment, totals, account }
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

export function saveOrder(order) {
  try {
    const all = listOrders();
    localStorage.setItem(KEY, JSON.stringify([order, ...all]));
  } catch {
    /* noop */
  }
}

export function getOrder(id) {
  return listOrders().find((o) => o.id === id) || null;
}

/** Status state machine — the admin will later drive transitions. */
export const ORDER_STATUS = {
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
};

export const STATUS_FLOW = [
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

export const STATUS_LABEL = {
  [ORDER_STATUS.CONFIRMED]: "Order Confirmed",
  [ORDER_STATUS.PROCESSING]: "Processing",
  [ORDER_STATUS.OUT_FOR_DELIVERY]: "Out for Delivery",
  [ORDER_STATUS.DELIVERED]: "Delivered",
  [ORDER_STATUS.CANCELLED]: "Cancelled",
};