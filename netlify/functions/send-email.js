/**
 * send-email  —  Netlify serverless function (customer order confirmation ONLY)
 *
 * The browser asks for an order's confirmation by id; it never chooses
 * the recipient, subject or content. This function loads the order
 * from Supabase with the service key and sends the confirmation to
 * the customer_email stored on that order — at most once per order:
 * orders.customer_email_sent_at is claimed (only if still null) before
 * sending, and released again if Resend refuses.
 *
 * Team notifications are NOT sent from here: a Supabase Database
 * Webhook calls notify-event.js when an order is confirmed.
 *
 * Orders still awaiting online payment (pending_payment) and
 * cancelled orders get no email.
 *
 * Env vars: RESEND_API_KEY, RESEND_FROM_EMAIL, SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY. Missing settings → 200 { ok: true,
 * skipped: true }, so checkout never breaks.
 *
 * Request body:  { type: "order_confirmation", orderId: "VLT-…" }
 *
 * Response:
 *   200 { ok: true, id }                 — sent
 *   200 { ok: true, skipped: true, reason }
 *   400 / 404 { ok: false, error }
 *   502 { ok: false, error }             — lookup failed / Resend refused
 */
import { orderConfirmationEmail } from "../../src/lib/emailTemplates.js";
import {
  isValidEmail, missingResendConfig, sendViaResend, supabaseConfigured, supabaseGet, supabasePatch,
} from "./_shared/email.js";

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
  if ((event.body || "").length > 2048) return reply(400, { ok: false, error: "Body too large" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { ok: false, error: "Invalid JSON body" });
  }

  const { type, orderId } = payload || {};
  if (type !== "order_confirmation" || typeof orderId !== "string" || !ORDER_ID_RE.test(orderId)) {
    return reply(400, { ok: false, error: "Expected { type: \"order_confirmation\", orderId }" });
  }

  const missing = missingResendConfig();
  if (!supabaseConfigured()) missing.push("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length) {
    console.warn(`[send-email] not configured (${missing.join(", ")}); skipping confirmation for ${orderId}`);
    return reply(200, { ok: true, skipped: true, reason: "not_configured" });
  }

  const id = encodeURIComponent(orderId);
  let row;
  try {
    const rows = await supabaseGet(`orders?id=eq.${id}&select=*,order_items(*)`);
    row = Array.isArray(rows) ? rows[0] : null;
  } catch (err) {
    console.error("[send-email] order lookup failed:", err.message);
    return reply(502, { ok: false, error: "Order lookup failed" });
  }
  if (!row) return reply(404, { ok: false, error: "Order not found" });
  if (NO_EMAIL_STATUSES.has(row.status)) {
    return reply(200, { ok: true, skipped: true, reason: `status_${row.status}` });
  }
  if (row.customer_email_sent_at) return reply(200, { ok: true, skipped: true, reason: "already_sent" });
  if (!isValidEmail(row.customer_email)) {
    return reply(200, { ok: true, skipped: true, reason: "no_customer_email" });
  }

  // Claim the send; an empty result means another call already did.
  const claimedAt = new Date().toISOString();
  try {
    const claimed = await supabasePatch(
      `orders?id=eq.${id}&customer_email_sent_at=is.null&select=id`,
      { customer_email_sent_at: claimedAt },
    );
    if (!Array.isArray(claimed) || !claimed.length) {
      return reply(200, { ok: true, skipped: true, reason: "already_sent" });
    }
  } catch (err) {
    console.error("[send-email] claim failed:", err.message);
    return reply(502, { ok: false, error: "Order update failed" });
  }

  const order = toTemplateOrder(row);
  const tmpl = orderConfirmationEmail(order);
  const sent = await sendViaResend({
    to: [row.customer_email.trim()],
    subject: tmpl.subject,
    html: tmpl.html,
    text: tmpl.text,
  });
  if (!sent.ok) {
    console.error(`[send-email] Resend error for ${orderId}:`, sent.status, sent.error);
    await supabasePatch(
      `orders?id=eq.${id}&customer_email_sent_at=eq.${encodeURIComponent(claimedAt)}`,
      { customer_email_sent_at: null },
    ).catch((err) => console.error("[send-email] release failed:", err.message));
    return reply(502, { ok: false, error: "Email provider error" });
  }
  console.log("[send-email] sent", { orderId, id: sent.id });
  return reply(200, { ok: true, id: sent.id });
};
