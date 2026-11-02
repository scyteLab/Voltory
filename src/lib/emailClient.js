/**
 * emailClient
 *
 * Asks the Netlify Function send-email to send an order's emails
 * (/.netlify/functions/send-email; /api/send-email also rewrites there).
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
 * Form notifications (contact, newsletter, installation, …) are NOT
 * sent from the browser: a Supabase Database Webhook calls
 * netlify/functions/notify-new-submission.js on INSERT.
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
 * Customer confirmation + team notification for a saved order.
 * Runs both in parallel; failures on either side don't affect the
 * other. Never throws.
 */
export async function sendOrderEmails(orderId) {
  const results = await Promise.allSettled([
    postEmail("order_confirmation", orderId),
    postEmail("order_admin_notify", orderId),
  ]);
  return {
    confirmation: results[0].status === "fulfilled" ? results[0].value : { ok: false },
    adminNotify:  results[1].status === "fulfilled" ? results[1].value : { ok: false },
  };
}
