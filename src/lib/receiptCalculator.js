import { BUSINESS_INFO } from "../config/businessInfo.js";

/**
 * receiptCalculator.js  —  pure receipt math + status
 *
 * Prices on NAVEN are VAT-inclusive. While the business is not
 * VAT-registered (BUSINESS_INFO.vatRegistered === false) receipts
 * show no VAT at all. If it registers later, the VAT inside the
 * goods is extracted for display without changing what the
 * customer paid:
 *      ₦100 at 7.5% = ₦93.02 goods + ₦6.98 VAT
 *
 * Terminology:
 *   subtotalIncVat  — goods subtotal as the customer sees it
 *   vatAmount       — VAT included in that subtotal (0 when not registered)
 *   totalExVat      — grand total minus vatAmount
 */

const VAT_RATE = BUSINESS_INFO.vatRate; // 0.075

/**
 * Extract VAT from a VAT-inclusive whole-naira amount.
 *      base = X / (1 + R),  vat = X − base
 */
export function extractVatFromInclusive(inclusiveAmount, rate = VAT_RATE) {
  if (!inclusiveAmount || inclusiveAmount <= 0) {
    return { exVat: 0, vat: 0 };
  }
  const exVat = Math.round(inclusiveAmount / (1 + rate));
  const vat   = inclusiveAmount - exVat;
  return { exVat, vat };
}

/**
 * Receipt line values for an order (storefront order shape).
 * vat* fields are present only when the business is VAT-registered.
 */
export function computeReceiptTotals(order) {
  if (!order?.totals) return null;

  const t = order.totals;
  const subtotalIncVat  = t.subtotal || 0;
  const discount        = t.discount || 0;
  const deliveryFee     = t.deliveryFee || 0;
  const installationFee = t.installationFee || 0;
  const grandTotal      = t.grand || 0;

  const totals = {
    subtotalIncVat, discount, deliveryFee, installationFee, grandTotal,
    vatRegistered: BUSINESS_INFO.vatRegistered,
  };
  if (!BUSINESS_INFO.vatRegistered) return totals;

  // Prefer the values stored on the order at issue time, else compute.
  const rate = order.vat_rate || VAT_RATE;
  const stored = order.vat_amount != null && order.vat_amount > 0 ? order.vat_amount : null;
  const vatAmount = stored ?? extractVatFromInclusive(subtotalIncVat - discount, rate).vat;
  return { ...totals, vatRate: rate, vatAmount, totalExVat: grandTotal - vatAmount };
}

/** 0.075 → "7.5%" */
export function formatVatRate(rate) {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

/**
 * Which document this order is:
 *   "cancelled" — cancelled or refunded (CANCELLED watermark)
 *   "paid"      — money received: OFFICIAL RECEIPT
 *   "pending"   — not paid yet: PROFORMA INVOICE
 *
 * Paid when the server has recorded payment_status 'paid'; for online
 * methods also when the order has moved past pending_payment (only the
 * server confirms those, after Paystack verifies the charge). Pay on
 * Delivery counts as paid once the order is delivered (cash collected).
 */
export function receiptStatus(order) {
  const s = String(order?.status || "").toLowerCase();
  if (["cancelled", "refunded"].includes(s)) return "cancelled";
  if (order?.paymentStatus === "paid") return "paid";
  const method = String(order?.payment?.method || order?.payment || "").toLowerCase();
  if (method === "pod") return s === "delivered" ? "paid" : "pending";
  if (["confirmed", "processing", "shipped", "delivered", "paid"].includes(s)) return "paid";
  return "pending";
}

/**
 * Document number from the order id (one per order, stable):
 *   VLT-202607301542-TRZX → receipt "NAV-R-202607301542-TRZX",
 *                           proforma "NAV-PI-202607301542-TRZX"
 */
export function documentNumber(order, status = receiptStatus(order)) {
  const core = String(order?.id || "").replace(/^VLT-/, "");
  return `${status === "pending" ? "NAV-PI" : "NAV-R"}-${core}`;
}

/** True for free-gift lines, both fresh (isGift) and loaded from Supabase (sku "gift:<id>"). */
export const isGiftLine = (item) => Boolean(item?.isGift) || String(item?.sku || "").startsWith("gift:");
