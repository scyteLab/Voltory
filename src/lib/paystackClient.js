/**
 * paystackClient
 *
 * Wraps the Paystack Inline JS SDK. Loads the script on demand
 * (not on app boot), opens the payment modal, and returns a
 * promise that resolves with { ok, ref } or rejects with { cancelled }.
 *
 * Behaviour when VITE_PAYSTACK_PUBLIC_KEY is not set:
 *   · openPaystack() rejects with a specific error
 *   · isPaystackConfigured() returns false, so callers can
 *     branch to an alternate flow (e.g. force pay-on-delivery)
 *
 * We NEVER hardcode a key. If the env var is missing the feature
 * is off, not broken.
 */

const PAYSTACK_SDK_URL = "https://js.paystack.co/v1/inline.js";

let sdkLoadPromise = null;

function loadPaystackSdk() {
  if (typeof window === "undefined") return Promise.reject(new Error("Paystack requires a browser environment"));
  if (window.PaystackPop) return Promise.resolve(window.PaystackPop);
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PAYSTACK_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.PaystackPop) resolve(window.PaystackPop);
      else reject(new Error("Paystack SDK loaded but PaystackPop is undefined"));
    };
    script.onerror = () => reject(new Error("Failed to load Paystack SDK — check network / adblocker"));
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

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
 * Opens the Paystack inline modal. Amount MUST be in kobo (naira × 100).
 *
 * @param {object} params
 * @param {number} params.amount       — in NAIRA (we convert to kobo internally)
 * @param {string} params.email
 * @param {string} params.reference    — use the Voltory order id
 * @param {object} params.metadata     — arbitrary payload sent to Paystack
 * @param {string[]} params.channels   — ['card', 'bank_transfer', 'ussd'] etc; empty = all
 *
 * Resolves with { ok: true, ref } on success.
 * Resolves with { ok: false, cancelled: true } if user closes modal.
 * Rejects with an Error if SDK / config fails.
 */
export async function openPaystack({ amount, email, reference, metadata = {}, channels = [] }) {
  const key = getPaystackPublicKey();
  if (!key) {
    throw new Error("Paystack public key not configured. Set VITE_PAYSTACK_PUBLIC_KEY in .env");
  }
  if (!amount || amount <= 0) throw new Error("Invalid amount");
  if (!email) throw new Error("Email required for Paystack payment");

  // eslint-disable-next-line no-console
  console.log("[paystack] opening modal", { amount, reference, channels });

  const PaystackPop = await loadPaystackSdk();

  return new Promise((resolve) => {
    const config = {
      key,
      email,
      amount: Math.round(amount * 100), // kobo
      currency: "NGN",
      ref: reference,
      metadata: {
        source: "naven-web",
        ...metadata,
      },
      callback: (response) => {
        // eslint-disable-next-line no-console
        console.log("[paystack] payment success", response);
        resolve({ ok: true, ref: response.reference, response });
      },
      onClose: () => {
        // eslint-disable-next-line no-console
        console.log("[paystack] modal closed by user");
        resolve({ ok: false, cancelled: true });
      },
    };

    if (channels && channels.length > 0) config.channels = channels;

    const handler = PaystackPop.setup(config);
    handler.openIframe();
  });
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