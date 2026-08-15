import {
  orderConfirmationEmail, adminOrderNotificationEmail,
} from "./emailTemplates.js";

/**
 * emailClient
 *
 * Fires order emails via the Netlify Function at /api/send-email.
 *
 * Every function here is FIRE-AND-FORGET:
 *   · Never blocks the checkout flow
 *   · Failures are logged, never surfaced to the customer
 *   · The order is the source of truth; email is a nice-to-have
 *
 * Behaviour when the endpoint is unavailable (local dev, function
 * not deployed yet, Resend key not set):
 *   · Fetch fails / returns non-2xx → log warning, move on
 *   · Endpoint returns { skipped: true } → log info, treat as success
 *
 * We deliberately DON'T retry — the order is confirmed; if the
 * email doesn't send, the admin can resend it from admin/orders/:id
 * later (that surface will be added when we build the admin email
 * tools).
 */

const EMAIL_ENDPOINT = "/api/send-email";

async function postEmail(payload) {
  try {
    const res = await fetch(EMAIL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn("[email] endpoint responded", res.status);
      return { ok: false, status: res.status };
    }
    const data = await res.json();
    if (data.skipped) {
      // eslint-disable-next-line no-console
      console.info("[email] skipped (not configured)", payload.type);
    }
    return { ok: true, ...data };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[email] send failed:", err?.message || err);
    return { ok: false, error: err?.message };
  }
}

/**
 * Send the customer order confirmation email.
 * No-op if customer.email is missing.
 */
export async function sendOrderConfirmation(order) {
  const to = order.contact?.email;
  if (!to) {
    // eslint-disable-next-line no-console
    console.info("[email] no customer email, skipping confirmation");
    return { ok: true, skipped: true };
  }
  const tmpl = orderConfirmationEmail(order);
  return postEmail({
    type: "order_confirmation",
    to,
    subject: tmpl.subject,
    html: tmpl.html,
  });
}

/**
 * Send the admin notification of a new order.
 * Recipient is derived from RESEND_ADMIN_EMAIL env var (server-side).
 * We send a request with `to: "admin"` and the function resolves
 * the real address from env.
 *
 * Simpler alternative: hardcode a fallback here. Doing that with a
 * config-based fallback so admin address changes without a deploy.
 */
export async function sendAdminOrderNotification(order, adminEmail = null) {
  // If caller didn't pass one, we can't know the admin address from
  // the browser. But the serverless function knows it via env var.
  // Send a sentinel and let the server fill it in — or fail gracefully.
  //
  // For now: if no adminEmail is passed and no fallback env is baked
  // in, we skip. Session 35c (admin config surface) can improve this.
  const to = adminEmail || import.meta.env.VITE_ADMIN_NOTIFY_EMAIL;
  if (!to) {
    // eslint-disable-next-line no-console
    console.info("[email] no admin email configured, skipping admin notify");
    return { ok: true, skipped: true };
  }
  const tmpl = adminOrderNotificationEmail(order);
  return postEmail({
    type: "order_admin_notify",
    to,
    subject: tmpl.subject,
    html: tmpl.html,
  });
}

/**
 * Fire both emails for a newly-placed order. Runs them in parallel;
 * failures on either side don't affect the other. Never throws.
 */
export async function sendOrderEmails(order) {
  const results = await Promise.allSettled([
    sendOrderConfirmation(order),
    sendAdminOrderNotification(order),
  ]);
  return {
    confirmation: results[0].status === "fulfilled" ? results[0].value : { ok: false },
    adminNotify:  results[1].status === "fulfilled" ? results[1].value : { ok: false },
  };
}