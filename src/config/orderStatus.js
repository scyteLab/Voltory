/**
 * ============================================================
 *  ORDER STATUS CONFIG
 *  Single source of truth for what each status means and what
 *  can transition to what. The detail page reads this to render
 *  only valid next-status buttons. The table reads it for chips.
 *
 *  Flow diagram:
 *     confirmed \u2192 processing \u2192 shipped \u2192 delivered \u2192 refunded
 *          \u2193           \u2193
 *      cancelled   cancelled
 * ============================================================
 */

export const ORDER_STATUSES = {
  confirmed:  { label: "Confirmed",  chip: "adm-chip--info", tone: "info",  order: 1 },
  processing: { label: "Processing", chip: "adm-chip--warn", tone: "warn",  order: 2 },
  shipped:    { label: "Shipped",    chip: "adm-chip--info", tone: "info",  order: 3 },
  delivered:  { label: "Delivered",  chip: "adm-chip--ok",   tone: "ok",    order: 4 },
  cancelled:  { label: "Cancelled",  chip: "adm-chip--err",  tone: "err",   order: 0 },
  refunded:   { label: "Refunded",   chip: "adm-chip--warn", tone: "warn",  order: 5 },
};

/**
 * Allowed transitions per current status. Empty array = terminal.
 * Cancel is always available from any pre-shipment state.
 */
export const STATUS_TRANSITIONS = {
  confirmed:  ["processing", "cancelled"],
  processing: ["shipped",   "cancelled"],
  shipped:    ["delivered"],
  delivered:  ["refunded"],
  cancelled:  [],
  refunded:   [],
};

/**
 * The forward timeline shown in the detail view. Cancelled/refunded
 * are branch states \u2014 they replace the last position rather than
 * appear in the linear flow.
 */
export const TIMELINE_ORDER = ["confirmed", "processing", "shipped", "delivered"];

/**
 * Format an order id for display: keep only the trailing chunk.
 * VLT-202601180430-A9F3 \u2192 "\u2026-A9F3" for compact table view.
 */
export function shortOrderId(id) {
  if (!id) return "";
  const parts = id.split("-");
  return parts.length > 2 ? `\u2026-${parts[parts.length - 1]}` : id;
}

/**
 * Human label for payment method.
 */
export const PAYMENT_LABELS = {
  card:     "Card",
  transfer: "Bank Transfer",
  pod:      "Pay on Delivery",
  ussd:     "USSD",
};