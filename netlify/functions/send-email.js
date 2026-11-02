/**
 * send-email  —  Netlify serverless function (order emails only)
 *
 * The browser asks for an order's emails by id; it never chooses the
 * recipient, subject or content. This function loads the order from
 * Supabase with the service key and builds both emails server-side:
 *
 *   order_confirmation  → the order's own customer_email
 *   order_admin_notify  → NOTIFY_EMAILS (or legacy RESEND_ADMIN_EMAIL)
 *
 * Orders still awaiting online payment (pending_payment) and
 * cancelled orders get no email.
 *
 * Remaining exposure: someone who knows a real order id can make the
 * same two emails go out again, to that order's customer and the team.
 * Order ids carry a random suffix and can't be listed by visitors.
 * The planned orders Database Webhook (see notify-new-submission.js)
 * would let this endpoint be removed entirely.
 *
 * Env vars: see _shared/email.js (RESEND_*, NOTIFY_EMAILS, SUPABASE_*).
 * Missing Resend or Supabase settings → 200 { ok: true, skipped: true },
 * so checkout never breaks.
 *
 * Request body:  { type: "order_confirmation" | "order_admin_notify", orderId: "VLT-…" }
 *
 * Response:
 *   200 { ok: true, id }                 — sent
 *   200 { ok: true, skipped: true, reason }
 *   400 / 404 { ok: false, error }
 *   502 { ok: false, error }             — Resend refused
 */
import {
  orderConfirmationEmail, adminOrderNotificationEmail,
} from "../../src/lib/emailTemplates.js";
import {
  isValidEmail, missingResendConfig, sendViaResend, supabaseConfigured, supabaseGet, teamRecipients,
} from "./_shared/email.js";

const TYPES = new Set(["order_confirmation", "order_admin_notify"]);
const ORDER_ID_RE = /^VLT-[A-Za-z0-9]+-[A-Za-z0-9]+$/;
const NO_EMAIL_STATUSES = new Set(["pending_payment", "cancelled"]);

const headers = { "Content-Type": "application/json" };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

/** Supabase row (orders + order_items) → the shape emailTemplates expects. */
function toTemplateOrder(row) {
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  return {
    id: row.id,
    createdAt: row.created_at,
    status: row.status,
    items: items.map((i) => ({ sku: i.sku, qty: i.qty, price: i.unit_price, name: i.product_name })),
    contact: {
      name:  row.customer_name  || "",
      phone: row.customer_phone || "",
      email: row.customer_email || "",
    },
    address: row.address || {},
    payment: { method: row.payment_method },
    paymentStatus: row.payment_status || "unpaid",
    paystackRef: row.paystack_ref || null,
    installation: (row.installation_fee || 0) > 0,
    totals: {
      subtotal:        row.subtotal || 0,
      discount:        row.discount || 0,
      deliveryFee:     row.delivery_fee || 0,
      installationFee: row.installation_fee || 0,
      grand:           row.total || 0,
    },
    account: { phone: row.customer_phone, name: row.customer_name },
    notes: row.notes || null,
  };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { ok: false, error: "Method not allowed" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { ok: false, error: "Invalid JSON body" });
  }

  const { type, orderId } = payload;
  if (!TYPES.has(type) || typeof orderId !== "string" || !ORDER_ID_RE.test(orderId)) {
    return reply(400, { ok: false, error: "Expected { type: order_confirmation | order_admin_notify, orderId }" });
  }

  const missing = missingResendConfig();
  if (missing.length || !supabaseConfigured()) {
    if (!supabaseConfigured()) missing.push("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    console.warn(`[send-email] not configured (${missing.join(", ")}); skipping ${type} for ${orderId}`);
    return reply(200, { ok: true, skipped: true, reason: "not_configured" });
  }

  let row;
  try {
    const rows = await supabaseGet(`orders?id=eq.${encodeURIComponent(orderId)}&select=*,order_items(*)`);
    row = Array.isArray(rows) ? rows[0] : null;
  } catch (err) {
    console.error("[send-email] order lookup failed:", err.message);
    return reply(502, { ok: false, error: "Order lookup failed" });
  }
  if (!row) return reply(404, { ok: false, error: "Order not found" });
  if (NO_EMAIL_STATUSES.has(row.status)) {
    return reply(200, { ok: true, skipped: true, reason: `status_${row.status}` });
  }

  const order = toTemplateOrder(row);
  let to;
  let tmpl;
  if (type === "order_confirmation") {
    if (!isValidEmail(order.contact.email)) {
      return reply(200, { ok: true, skipped: true, reason: "no_customer_email" });
    }
    to = [order.contact.email.trim()];
    tmpl = orderConfirmationEmail(order);
  } else {
    to = teamRecipients();
    if (!to.length) {
      console.warn("[send-email] NOTIFY_EMAILS / RESEND_ADMIN_EMAIL not set; skipping admin notify");
      return reply(200, { ok: true, skipped: true, reason: "no_team_recipients" });
    }
    tmpl = adminOrderNotificationEmail(order);
  }

  const sent = await sendViaResend({
    to,
    subject: tmpl.subject,
    html: tmpl.html,
    text: tmpl.text,
    replyTo: type === "order_admin_notify" ? order.contact.email : undefined,
  });
  if (!sent.ok) {
    console.error(`[send-email] Resend error for ${type} ${orderId}:`, sent.status, sent.error);
    return reply(502, { ok: false, error: "Email provider error" });
  }
  console.log("[send-email] sent", { type, orderId, id: sent.id });
  return reply(200, { ok: true, id: sent.id });
};
