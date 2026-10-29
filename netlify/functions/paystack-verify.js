/**
 * paystack-verify  —  Netlify serverless function
 *
 * Called by the browser after the Paystack popup reports success.
 * The browser sends ONLY the reference; it cannot mark anything paid.
 * We ask Paystack directly and mark the order paid only if the
 * charge is successful, in NGN, and for exactly the order total.
 * See _shared/paystackOrders.js for the checks.
 *
 * Request:   POST /api/paystack-verify  { reference: "NAVEN-<orderId>-<ts>" }
 * Response:  200 { paymentStatus: "paid" | "pending" | "unpaid" }
 *            400 / 404 / 500 { paymentStatus: "unknown", error }
 *
 * Idempotent: repeated calls for a paid order just return "paid".
 */

import { missingConfig, reconcilePayment } from "./_shared/paystackOrders.js";

const headers = { "Content-Type": "application/json" };

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return reply(405, { paymentStatus: "unknown", error: "Method not allowed" });
  }

  const missing = missingConfig();
  if (missing.length) {
    console.error("[paystack-verify] missing env vars:", missing.join(", "));
    return reply(500, { paymentStatus: "unknown", error: "Payment verification is not configured" });
  }

  let reference;
  try {
    ({ reference } = JSON.parse(event.body || "{}"));
  } catch {
    return reply(400, { paymentStatus: "unknown", error: "Invalid JSON" });
  }
  if (typeof reference !== "string" || !reference) {
    return reply(400, { paymentStatus: "unknown", error: "reference is required" });
  }

  try {
    const result = await reconcilePayment(reference);
    if (result.httpStatus !== 200) {
      return reply(result.httpStatus, { paymentStatus: result.paymentStatus, error: result.reason });
    }
    return reply(200, { paymentStatus: result.paymentStatus });
  } catch (err) {
    console.error("[paystack-verify] error:", err?.message || err);
    return reply(500, { paymentStatus: "unknown", error: "Could not verify payment right now" });
  }
};
