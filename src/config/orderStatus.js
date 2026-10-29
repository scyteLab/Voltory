/**
 * ============================================================
 *  ORDER STATUS CONFIG
 *  Single source of truth for what each status means and what
 *  can transition to what. The detail page reads this to render
 *  only valid next-status buttons. The table reads it for chips.
 *
 *  Flow diagram:
 *     pending_payment ─(server, after Paystack verifies)→ confirmed
 *     pending_payment → cancelled  (staff may cancel an abandoned payment)
 *     confirmed → processing → shipped → delivered → refunded
 *          ↓           ↓
 *      cancelled   cancelled
 * ============================================================
 */

export const ORDER_STATUSES = {
  pending_payment: { label: "Awaiting payment", chip: "adm-chip--warn", tone: "warn", order: 0 },
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
  // Never "confirmed"/"processing" from here: only the server confirms
  // an online order, once Paystack has verified the money. This also
  // keeps unpaid orders out of the fulfilment pipeline.
  pending_payment: ["cancelled"],
  confirmed:  ["processing", "cancelled"],
  processing: ["shipped",   "cancelled"],
  shipped:    ["delivered"],
  delivered:  ["refunded"],
  cancelled:  [],
  refunded:   [],
};

/**
 * The forward timeline shown in the detail view. Cancelled/refunded
 * are branch states — they replace the last position rather than
 * appear in the linear flow.
 */
export const TIMELINE_ORDER = ["confirmed", "processing", "shipped", "delivered"];

/**
 * Format an order id for display: keep only the trailing chunk.
 * VLT-202601180430-A9F3 → "…-A9F3" for compact table view.
 */
export function shortOrderId(id) {
  if (!id) return "";
  const parts = id.split("-");
  return parts.length > 2 ? `…-${parts[parts.length - 1]}` : id;
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

/**
 * Payment-state chip for an order row. 'paid' is only ever written
 * by the paystack-verify / paystack-webhook server functions, so a
 * "Paid" chip means Paystack confirmed the money. Online orders that
 * haven't been confirmed must never look paid.
 */
export function paymentStateChip(row) {
  if (row?.payment_status === "paid") {
    return { label: "Paid", chip: "adm-chip--ok" };
  }
  if (row?.payment_method === "pod" || row?.payment_method === "pay_on_delivery") {
    return { label: "Pay on Delivery", chip: "adm-chip--info" };
  }
  if (row?.payment_status === "pending") {
    return { label: "Pending payment", chip: "adm-chip--warn" };
  }
  return { label: "Unpaid", chip: "adm-chip--err" };
}
