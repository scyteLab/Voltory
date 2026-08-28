import { BUSINESS_INFO } from "../config/businessInfo.js";

/**
 * receiptCalculator.js  \u2014  pure VAT + receipt math
 *
 * Handles VAT-inclusive pricing correctly. When a customer
 * sees \u20A6100 and prices include 7.5% VAT, that \u20A6100 is
 * really:
 *      \u20A693.02 goods + \u20A66.98 VAT
 *
 * We must extract VAT for the receipt (FIRS wants the breakdown)
 * without changing what the customer paid.
 *
 * All internal math uses INTEGER KOBO to avoid float errors.
 * Naira formatting happens at display time only.
 *
 * Terminology used across the code:
 *   subtotal_ex_vat  \u2014 subtotal with VAT removed (goods only)
 *   vat_amount       \u2014 VAT portion extracted from subtotal
 *   subtotal         \u2014 as customer sees it (already includes VAT)
 */

const VAT_RATE = BUSINESS_INFO.vatRate;         // 0.075

/**
 * Extract VAT from a VAT-inclusive amount.
 * Given inclusive amount X and rate R:
 *      base = X / (1 + R)
 *      vat  = X - base
 * Returns { exVat, vat } as integers (kobo).
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
 * Given an order, compute the receipt line values.
 * Uses stored vat_amount / subtotal_ex_vat if available
 * (post-migration), otherwise recomputes on the fly. This
 * lets receipts work for both new orders and old ones that
 * haven't been backfilled yet.
 *
 * Returns a shape flat enough to feed directly into a
 * receipt template without further processing.
 */
export function computeReceiptTotals(order) {
  if (!order?.totals) return null;

  const t = order.totals;
  const subtotalIncVat = t.subtotal || 0;

  // Prefer stored values (post-migration), fall back to on-the-fly
  const storedExVat = order.subtotal_ex_vat;
  const storedVat   = order.vat_amount;

  let subtotalExVat, vatAmount;
  if (storedExVat != null && storedVat != null && (storedExVat > 0 || storedVat > 0)) {
    subtotalExVat = storedExVat;
    vatAmount     = storedVat;
  } else {
    const extracted = extractVatFromInclusive(subtotalIncVat);
    subtotalExVat = extracted.exVat;
    vatAmount     = extracted.vat;
  }

  const discount        = t.discount || 0;
  const deliveryFee     = t.deliveryFee || 0;
  const installationFee = t.installationFee || 0;
  const grandTotal      = t.grand || 0;

  return {
    subtotalIncVat,
    subtotalExVat,
    vatAmount,
    vatRate: order.vat_rate || VAT_RATE,
    discount,
    deliveryFee,
    installationFee,
    grandTotal,
  };
}

/**
 * Format a VAT rate as a display string: 0.075 \u2192 "7.5%"
 */
export function formatVatRate(rate) {
  return `${(rate * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

/**
 * Whether an order should be treated as fully-paid on the
 * receipt (affects the PAID stamp vs CANCELLED watermark).
 */
export function receiptStatus(order) {
  const s = String(order?.status || "").toLowerCase();
  if (["cancelled", "refunded"].includes(s)) return "cancelled";
  if (["confirmed", "processing", "shipped", "delivered", "paid"].includes(s)) return "paid";
  return "pending";
}