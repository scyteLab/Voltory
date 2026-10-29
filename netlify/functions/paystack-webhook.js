/**
 * paystack-webhook  —  Netlify serverless function
 *
 * Paystack calls this for transaction events. It is the safety net
 * for customers who pay but never get back to the site (closed tab,
 * slow bank transfer, flaky network during paystack-verify).
 *
 * Set the webhook URL in the Paystack dashboard (Settings → API Keys
 * & Webhooks) to:  https://<your-domain>/api/paystack-webhook
 *
 * Security:
 *   · x-paystack-signature must equal HMAC-SHA512(raw body, PAYSTACK_SECRET_KEY),
 *     otherwise 401.
 *   · Even a correctly signed event is not trusted on its own: we
 *     re-verify with Paystack's verify API and apply the same
 *     status / currency / exact-amount checks as paystack-verify.
 *
 * Valid events always get 200 so Paystack doesn't retry endlessly;
 * failures are logged for follow-up.
 */

import crypto from "node:crypto";
import { missingConfig, reconcilePayment } from "./_shared/paystackOrders.js";

function signatureIsValid(rawBody, signature) {
  if (typeof signature !== "string" || !signature) return false;
  const expected = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const missing = missingConfig();
  if (missing.length) {
    console.error("[paystack-webhook] missing env vars:", missing.join(", "));
    return { statusCode: 500, body: "Not configured" };
  }

  const rawBody = Buffer.from(event.body || "", event.isBase64Encoded ? "base64" : "utf8");
  const signature = event.headers?.["x-paystack-signature"];
  if (!signatureIsValid(rawBody, signature)) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return { statusCode: 200, body: "ignored" };
  }

  if (payload?.event === "charge.success") {
    const reference = payload.data?.reference;
    try {
      const result = await reconcilePayment(reference);
      console.log("[paystack-webhook] charge.success", { reference, ...result });
    } catch (err) {
      console.error("[paystack-webhook] reconcile error:", { reference, error: err?.message || err });
    }
  }

  return { statusCode: 200, body: "ok" };
};
