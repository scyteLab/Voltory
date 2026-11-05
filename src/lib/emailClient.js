/**
 * emailClient
 *
 * Asks the Netlify Function send-email to send an order's customer
 * confirmation (/.netlify/functions/send-email; /api/send-email also
 * rewrites there).
 *
 * The browser sends ONLY { type, orderId }. The function loads the
 * order from Supabase with the service key and decides the recipient
 * and the content itself, so this endpoint can't be used to send
 * arbitrary mail. The order must already be saved in Supabase.
 *
 * Every function here is FIRE-AND-FORGET:
 *   · Never blocks the checkout flow
 *   · Failures are logged, never surfaced to the customer
 *   · The order is the source of truth; email is a nice-to-have
 *
 * Team notifications (orders, WhatsApp quotes, contact, warranty,
 * forms) are NOT sent from the browser: Supabase Database Webhooks
 * call netlify/functions/notify-event.js.
 */

// Direct function path: doesn't depend on the /api rewrite.
const EMAIL_ENDPOINT = "/.netlify/functions/send-email";

async function postEmail(type, orderId) {
  try {
    const res = await fetch(EMAIL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, orderId }),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn("[email] endpoint responded", res.status, type);
      return { ok: false, status: res.status };
    }
    const data = await res.json();
    if (data.skipped) {
      // eslint-disable-next-line no-console
      console.info("[email] skipped:", type, data.reason || "");
    }
    return { ok: true, ...data };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[email] send failed:", err?.message || err);
    return { ok: false, error: err?.message };
  }
}

/**
 * Customer confirmation for a saved order. The server sends it at most
 * once per order, so calling this again is harmless. Never throws.
 * (The team is notified by the orders Database Webhook, not from here.)
 */
export function sendOrderConfirmation(orderId) {
  return postEmail("order_confirmation", orderId);
}
