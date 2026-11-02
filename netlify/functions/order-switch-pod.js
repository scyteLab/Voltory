/**
 * order-switch-pod  —  Netlify serverless function
 *
 * Called by checkout when a customer abandons an online payment and
 * chooses Pay on Delivery for the same order. Converts that order
 * (pending_payment → confirmed, pod, unpaid) with the service role,
 * because the browser's anon role can insert orders but not update
 * them. See switchOrderToPod in _shared/paystackOrders.js.
 *
 * Pay on Delivery is refused for orders above POD_MAX_ORDER_TOTAL
 * (env, naira; default 450000 — keep in step with SITE.podMaxOrderTotal
 * and supabase/pod_limit_guard.sql).
 *
 * Request:   POST { orderId: "VLT-..." }
 * Response:  200 { ok: true,  paymentStatus: "unpaid" }  — now POD
 *            200 { ok: false, paymentStatus: "paid" }    — it was paid after all
 *            422 { ok: false, error: "pod_limit_exceeded" }
 *            4xx/5xx { ok: false, error }
 */

import { missingConfig, switchOrderToPod } from "./_shared/paystackOrders.js";

const headers = { "Content-Type": "application/json" };

const DEFAULT_POD_MAX = 450000;

function podMaxOrderTotal() {
  const n = Number(process.env.POD_MAX_ORDER_TOTAL);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_POD_MAX;
}

function reply(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return reply(405, { ok: false, error: "Method not allowed" });
  }

  const missing = missingConfig();
  if (missing.length) {
    console.error("[order-switch-pod] missing env vars:", missing.join(", "));
    return reply(500, { ok: false, error: "Not configured" });
  }

  let orderId;
  try {
    ({ orderId } = JSON.parse(event.body || "{}"));
  } catch {
    return reply(400, { ok: false, error: "Invalid JSON" });
  }

  try {
    const result = await switchOrderToPod(orderId, { maxTotal: podMaxOrderTotal() });
    return reply(result.httpStatus, {
      ok: result.ok,
      paymentStatus: result.paymentStatus,
      ...(result.reason ? { error: result.reason } : {}),
    });
  } catch (err) {
    console.error("[order-switch-pod] error:", err?.message || err);
    return reply(500, { ok: false, error: "Could not update the order right now" });
  }
};
