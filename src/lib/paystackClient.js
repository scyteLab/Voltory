/**
 * paystackClient
 *
 * Wraps the official Paystack Inline JS v2 SDK (@paystack/inline-js).
 * The SDK is imported lazily so it only ships to customers who reach
 * the payment step.
 *
 * SECURITY: nothing in this file (or anywhere in the browser) may
 * mark an order as paid. A successful popup only means "the customer
 * says they paid" — we then ask our own server (verifyPaystackPayment)
 * which asks Paystack directly and is the only thing allowed to set
 * payment_status = 'paid'.
 *
 * Behaviour when VITE_PAYSTACK_PUBLIC_KEY is not set:
 *   · openPaystack() rejects with a specific error
 *   · isPaystackConfigured() returns false, so callers can
 *     branch to an alternate flow (e.g. force pay-on-delivery)
 *
 * We NEVER hardcode a key. If the env var is missing the feature
 * is off, not broken.
 */

/**
 * Returns the public key from Vite env if present, else null.
 */
export function getPaystackPublicKey() {
  return import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || null;
}

/**
 * True if a public key is set.
 */
export function isPaystackConfigured() {
  return !!getPaystackPublicKey();
}

/**
 * Build a unique Paystack reference for an order attempt.
 * Format: NAVEN-<orderId>-<timestamp>. The server parses the order id
 * back out of it, so a retry with a fresh reference still resolves
 * to the same order.
 */
export function buildPaystackReference(orderId) {
  return `NAVEN-${orderId}-${Date.now()}`;
}

/**
 * Opens the Paystack popup.
 *
 * @param {object} params
 * @param {number} params.amountKobo   — integer, in KOBO (naira × 100)
 * @param {string} params.email
 * @param {string} params.reference    — from buildPaystackReference()
 * @param {object} params.metadata     — arbitrary payload sent to Paystack
 * @param {string[]} params.channels   — ['card', 'bank_transfer', 'ussd'] etc; empty = all
 *
 * Resolves with { ok: true, ref } when the popup reports success
 *   (NOT proof of payment — verify on the server).
 * Resolves with { ok: false, cancelled: true } if the customer closes it.
 * Rejects with an Error if SDK / config fails.
 */
export async function openPaystack({ amountKobo, email, reference, metadata = {}, channels = [] }) {
  const key = getPaystackPublicKey();
  if (!key) {
    throw new Error("Paystack public key not configured. Set VITE_PAYSTACK_PUBLIC_KEY in .env");
  }
  if (!Number.isInteger(amountKobo) || amountKobo <= 0) throw new Error("Invalid amount");
  if (!email) throw new Error("Email required for Paystack payment");
  if (!reference) throw new Error("Payment reference required");

  const { default: PaystackPop } = await import("@paystack/inline-js");

  return new Promise((resolve, reject) => {
    const config = {
      key,
      email,
      amount: amountKobo,
      currency: "NGN",
      reference,
      metadata: {
        source: "naven-web",
        ...metadata,
      },
      onSuccess: (transaction) => {
        resolve({ ok: true, ref: transaction?.reference || reference });
      },
      onCancel: () => {
        resolve({ ok: false, cancelled: true });
      },
      onError: (error) => {
        reject(new Error(error?.message || "Paystack could not start the payment"));
      },
    };

    if (channels && channels.length > 0) config.channels = channels;

    try {
      new PaystackPop().newTransaction(config);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Ask our server to confirm a payment with Paystack. The server is
 * the only party that can mark the order paid.
 *
 * Resolves with { paymentStatus: 'paid' | 'pending' | ... }.
 * Never throws — network failures resolve to { paymentStatus: 'unknown', error }.
 */
export async function verifyPaystackPayment(reference) {
  try {
    const res = await fetch("/api/paystack-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { paymentStatus: data.paymentStatus || "unknown", error: data.error || `HTTP ${res.status}` };
    return { paymentStatus: data.paymentStatus || "unknown" };
  } catch (err) {
    return { paymentStatus: "unknown", error: err?.message || String(err) };
  }
}

/**
 * Retry payment for an order that already exists (status
 * pending_payment), e.g. from "Pay now" on the order page. Charges
 * exactly the stored order total under a fresh reference for the
 * same order id, then asks the server to verify.
 *
 * Resolves with { outcome: 'paid' | 'cancelled' | 'unconfirmed' }.
 * Rejects only if the popup can't start.
 */
export async function payForExistingOrder(order) {
  const method = order.payment?.method || order.payment;
  const channel = paystackChannelFor(method);
  const phone = order.contact?.phone || "";
  const result = await openPaystack({
    amountKobo: Math.round(Number(order.totals?.grand || 0)) * 100,
    email: order.contact?.email || `${phone.replace(/\D/g, "")}@mynaven.com`,
    reference: buildPaystackReference(order.id),
    channels: channel ? [channel] : [],
    metadata: {
      orderId: order.id,
      customerName: order.contact?.name || "",
      customerPhone: phone,
      method,
    },
  });
  if (!result.ok) return { outcome: "cancelled" };
  const { paymentStatus } = await verifyPaystackPayment(result.ref);
  return { outcome: paymentStatus === "paid" ? "paid" : "unconfirmed" };
}

/**
 * Map our internal payment method id to Paystack's channel string.
 * Returns null if the method shouldn't route through Paystack (pod).
 */
export function paystackChannelFor(methodId) {
  switch (methodId) {
    case "card":     return "card";
    case "transfer": return "bank_transfer";
    case "ussd":     return "ussd";
    case "pod":      return null;
    default:         return "card";
  }
}
