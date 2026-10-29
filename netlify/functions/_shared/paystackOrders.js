/**
 * Shared server-side Paystack + Supabase helpers for the
 * paystack-verify and paystack-webhook Netlify functions.
 *
 * Lives in a subfolder so Netlify bundles it into those functions
 * instead of deploying it as a function of its own.
 *
 * THIS IS THE ONLY CODE ALLOWED TO SET payment_status = 'paid'.
 * It does so only after asking Paystack directly and checking:
 *   · status   === 'success'
 *   · currency === 'NGN'
 *   · amount (kobo) === order total × 100, exactly
 *
 * Expected env vars (Netlify dashboard → Site settings → Environment
 * variables; never in the browser bundle):
 *   PAYSTACK_SECRET_KEY        — sk_test_... / sk_live_...
 *   SUPABASE_URL               — falls back to VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  — bypasses RLS; server-side only
 */

const PAYSTACK_API = "https://api.paystack.co";

// NAVEN-<orderId>-<timestamp>, where orderId is VLT-YYYYMMDDHHmm-XXXX.
const REFERENCE_PATTERN = /^NAVEN-(VLT-[A-Za-z0-9]+-[A-Za-z0-9]+)-(\d+)$/;

// Paystack channel → our payment_method enum. Unknown channels keep
// whatever the order already had.
const CHANNEL_TO_METHOD = {
  card: "card",
  bank_transfer: "transfer",
  ussd: "ussd",
};

export function orderIdFromReference(reference) {
  if (typeof reference !== "string") return null;
  const m = reference.match(REFERENCE_PATTERN);
  return m ? m[1] : null;
}

export function missingConfig() {
  const missing = [];
  if (!process.env.PAYSTACK_SECRET_KEY) missing.push("PAYSTACK_SECRET_KEY");
  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) missing.push("SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return missing;
}

/**
 * Ask Paystack for the authoritative state of a transaction.
 * Resolves with the transaction `data` object, or null if Paystack
 * doesn't know the reference (e.g. popup closed before it started).
 * Throws on network / auth failures.
 */
async function fetchPaystackTransaction(reference) {
  const res = await fetch(`${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok || json.status !== true) {
    throw new Error(`Paystack verify failed: HTTP ${res.status} ${json.message || ""}`.trim());
  }
  return json.data || null;
}

async function supabaseRequest(path, init = {}) {
  const base = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Supabase ${init.method || "GET"} ${path.split("?")[0]} failed: HTTP ${res.status} ${json?.message || ""}`.trim());
  }
  return json;
}

async function loadOrder(orderId) {
  const rows = await supabaseRequest(
    `orders?id=eq.${encodeURIComponent(orderId)}&select=id,total,payment_status,payment_method,paystack_ref`
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * Flip the order to paid. The `payment_status=neq.paid` filter makes
 * this idempotent: an already-paid order is never touched again.
 */
async function markOrderPaid(orderId, transaction) {
  const patch = { payment_status: "paid", paystack_ref: transaction.reference };
  const method = CHANNEL_TO_METHOD[transaction.channel];
  if (method) patch.payment_method = method;
  await supabaseRequest(
    `orders?id=eq.${encodeURIComponent(orderId)}&payment_status=neq.paid`,
    { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(patch) }
  );
}

/**
 * Verify a reference with Paystack and, if every check passes, mark
 * its order paid. Safe to call any number of times.
 *
 * Resolves with { httpStatus, paymentStatus, reason? }.
 */
export async function reconcilePayment(reference) {
  const orderId = orderIdFromReference(reference);
  if (!orderId) return { httpStatus: 400, paymentStatus: "unknown", reason: "invalid_reference" };

  const order = await loadOrder(orderId);
  if (!order) return { httpStatus: 404, paymentStatus: "unknown", reason: "order_not_found" };

  // Idempotent: once paid, always paid. No need to call Paystack again.
  if (order.payment_status === "paid") return { httpStatus: 200, paymentStatus: "paid" };

  const tx = await fetchPaystackTransaction(reference);
  if (!tx) return { httpStatus: 200, paymentStatus: order.payment_status, reason: "transaction_not_found" };

  const expectedKobo = Math.round(Number(order.total) * 100);
  const failures = [];
  if (tx.status !== "success") failures.push(`status=${tx.status}`);
  if (tx.reference !== reference) failures.push("reference_mismatch");
  if (tx.currency !== "NGN") failures.push(`currency=${tx.currency}`);
  if (!Number.isInteger(tx.amount) || tx.amount !== expectedKobo) {
    failures.push(`amount=${tx.amount} expected=${expectedKobo}`);
  }

  if (failures.length) {
    if (tx.status === "success") {
      // Money moved but doesn't match the order — needs a human.
      console.error("[paystack] successful charge failed order checks", { orderId, reference, failures });
    }
    return { httpStatus: 200, paymentStatus: order.payment_status, reason: failures.join(",") };
  }

  await markOrderPaid(orderId, tx);
  console.log("[paystack] order marked paid", { orderId, reference });
  return { httpStatus: 200, paymentStatus: "paid" };
}
