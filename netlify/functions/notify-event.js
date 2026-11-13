/**
 * notify-event  —  Netlify serverless function
 *
 * Team email notifications, triggered by the DATABASE (Supabase
 * Database Webhooks), never by the browser. One webhook per table:
 *
 *   orders                  INSERT + UPDATE → NOTIFY_ORDERS_TO
 *   whatsapp_quotes         INSERT          → NOTIFY_ORDERS_TO
 *   contact_messages        INSERT          → NOTIFY_SUPPORT_TO
 *   warranty_claims         INSERT          → NOTIFY_SUPPORT_TO
 *   form_submissions        INSERT          → NOTIFY_SUPPORT_TO
 *   newsletter_subscribers  INSERT          → NOTIFY_SUPPORT_TO
 *   reviews                 INSERT + UPDATE → NOTIFY_SUPPORT_TO  (when a review
 *                           needs moderating: new, or edited back to pending)
 *
 * Supabase sends:  { type, table, schema, record, old_record }
 * with our header  x-webhook-secret: <WEBHOOK_SECRET>
 *
 * Orders are emailed once, when they become confirmed:
 *   INSERT with status 'confirmed'                 (Pay on Delivery)
 *   UPDATE status pending_payment → confirmed      (Paystack paid, or switched to POD)
 * The order is claimed by setting orders.admin_notified_at (only if
 * still null) before sending, so retries and duplicate deliveries
 * can't send it twice. If Resend refuses, the claim is released.
 *
 * Env vars (Netlify):
 *   WEBHOOK_SECRET      — required; anything without it gets 401
 *   RESEND_API_KEY, RESEND_FROM_EMAIL
 *   NOTIFY_ORDERS_TO    — default "business@mynaven.com,support@mynaven.com"
 *   NOTIFY_SUPPORT_TO   — default "support@mynaven.com,business@mynaven.com"
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — to load order / quote items
 *   SITE_URL            — optional; admin links (default: Netlify URL, else https://mynaven.com)
 *
 * Missing settings are logged and answered 200: the row is already
 * saved and nothing in the database waits on this function.
 */
import { timingSafeEqual } from "node:crypto";
import { FORM_TYPES, submissionDataRows } from "../../src/config/formTypes.js";
import {
  isValidEmail, missingResendConfig, recipientsFromEnv, sendViaResend, siteOrigin,
  supabaseConfigured, supabaseGet, supabasePatch,
} from "./_shared/email.js";
import { lagosTime, naira, notificationEmail, subjectLine } from "./_shared/notifyTemplates.js";

const MAX_BODY_BYTES = 50 * 1024;

const ORDERS_TO_DEFAULT  = "business@mynaven.com,support@mynaven.com";
const SUPPORT_TO_DEFAULT = "support@mynaven.com,business@mynaven.com";

const headers = { "Content-Type": "application/json" };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAYMENT_METHODS = { pod: "Pay on Delivery", card: "Card", transfer: "Bank transfer", ussd: "USSD" };

const humanise = (key) => key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const show = (v) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
const path = (p) => `${siteOrigin()}${p}`;

/**
 * The browser saves the header row first and its items in a second
 * request, so the webhook can arrive before the items exist. Wait a
 * little for them; an email with no items still goes out after that.
 */
async function loadItems(query) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt) await sleep(1000);
    const rows = await supabaseGet(query);
    if (Array.isArray(rows) && rows.length) return rows;
  }
  return [];
}

const toItems = (rows) => rows.map((i) => ({
  name: i.product_name, sku: i.sku, qty: i.qty,
  unitPrice: i.unit_price, lineTotal: i.line_total ?? (i.unit_price || 0) * (i.qty || 1),
}));

function addressLines(a) {
  if (!a || typeof a !== "object") return show(a);
  const main = [a.street, a.lga, a.state].filter(Boolean).join(", ");
  const extra = Object.entries(a)
    .filter(([k, v]) => !["street", "lga", "state"].includes(k) && v != null && v !== "")
    .map(([k, v]) => `${humanise(k)}: ${show(v)}`);
  return [main, ...extra].filter(Boolean).join("\n");
}

/* ------------------------------------------------------------------
   orders
   ------------------------------------------------------------------ */

function orderBecameConfirmed(type, record, old) {
  if (record?.status !== "confirmed" || record.admin_notified_at) return false;
  if (type === "INSERT") return true;
  return type === "UPDATE" && old?.status === "pending_payment";
}

async function handleOrder({ type, record, old_record: old }) {
  if (!orderBecameConfirmed(type, record, old)) return { skipped: "not_newly_confirmed" };
  if (!supabaseConfigured()) return { notConfigured: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" };

  const id = encodeURIComponent(record.id);
  const claimedAt = new Date().toISOString();
  const claimed = await supabasePatch(
    `orders?id=eq.${id}&status=eq.confirmed&admin_notified_at=is.null&select=*`,
    { admin_notified_at: claimedAt },
  );
  const order = Array.isArray(claimed) ? claimed[0] : null;
  if (!order) return { skipped: "already_notified" };

  const items = toItems(await loadItems(`order_items?order_id=eq.${id}&select=*`));
  const payLabel = order.payment_method === "pod"
    ? "Pay on Delivery"
    : order.payment_status === "paid" ? "Paid via Paystack" : `${PAYMENT_METHODS[order.payment_method] || order.payment_method} — not paid`;

  const totals = [
    ["Subtotal", naira(order.subtotal)],
    ["Discount", order.discount ? `−${naira(order.discount)}` : naira(0)],
    ["Delivery", order.delivery_fee ? naira(order.delivery_fee) : "Free"],
    ["Installation", naira(order.installation_fee)],
    ["Total", naira(order.total), true],
  ];
  const { html, text } = notificationEmail({
    heading: `New order ${order.id}`,
    intro: `${naira(order.total)} · ${payLabel} · ${items.length} line${items.length === 1 ? "" : "s"}`,
    rows: [
      ["Order ID", order.id],
      ["Customer", order.customer_name],
      ["Phone", order.customer_phone],
      ["Email", order.customer_email],
      ["Delivery address", addressLines(order.address)],
      ["Payment method", PAYMENT_METHODS[order.payment_method] || order.payment_method],
      ["Payment status", order.payment_status],
      ...(order.paystack_ref ? [["Paystack ref", order.paystack_ref]] : []),
      ...(order.notes ? [["Notes", order.notes]] : []),
      ["Order time", lagosTime(order.created_at)],
    ],
    items,
    totals,
    adminUrl: path(`/admin/orders/${id}`),
  });

  return {
    to: recipientsFromEnv("NOTIFY_ORDERS_TO", ORDERS_TO_DEFAULT),
    subject: `🛒 New order ${order.id} — ${naira(order.total)} (${payLabel})`,
    html, text,
    replyTo: order.customer_email,
    // Send failed → let a later event (or a manual re-save) try again.
    onFail: () => supabasePatch(
      `orders?id=eq.${id}&admin_notified_at=eq.${encodeURIComponent(claimedAt)}`,
      { admin_notified_at: null },
    ),
  };
}

/* ------------------------------------------------------------------
   whatsapp_quotes
   ------------------------------------------------------------------ */

async function handleWhatsappQuote({ record: q }) {
  const id = encodeURIComponent(q.id);
  const items = supabaseConfigured()
    ? toItems(await loadItems(`whatsapp_quote_items?quote_id=eq.${id}&select=*`))
    : [];
  if (!supabaseConfigured()) console.warn("[notify-event] Supabase not configured; quote email has no items");

  const { html, text } = notificationEmail({
    heading: `WhatsApp quote ${q.id}`,
    intro: `${naira(q.subtotal)} · customer was sent to WhatsApp`,
    rows: [
      ["Quote ID", q.id],
      ["Customer", q.customer_name],
      ["Phone", q.customer_phone],
      ["Email", q.customer_email],
      ["Status", q.status],
      ["Received", lagosTime(q.created_at)],
    ],
    items,
    totals: [["Subtotal", naira(q.subtotal), true]],
    adminUrl: path(`/admin/whatsapp-quotes/${id}`),
  });
  return {
    to: recipientsFromEnv("NOTIFY_ORDERS_TO", ORDERS_TO_DEFAULT),
    subject: `💬 WhatsApp quote ${q.id} — ${naira(q.subtotal)}`,
    html, text,
    replyTo: q.customer_email,
  };
}

/* ------------------------------------------------------------------
   reviews
   ------------------------------------------------------------------ */

const STARS = (n) => "★".repeat(Math.max(0, Math.min(5, n || 0))) + "☆".repeat(5 - Math.max(0, Math.min(5, n || 0)));

/** New review, or an edit / status change that put it back in the queue. */
export function reviewNeedsModeration(type, record, old) {
  if (record?.status !== "pending") return false;
  if (type === "INSERT") return true;
  if (type !== "UPDATE") return false;
  if (!old) return true;
  return old.status !== "pending"
    || old.rating !== record.rating || (old.title || "") !== (record.title || "") || (old.body || "") !== (record.body || "");
}

async function handleReview({ type, record: r, old_record: old }) {
  if (!reviewNeedsModeration(type, r, old)) return { skipped: "not_pending_change" };

  let productName = r.product_sku;
  let customerName = "";
  if (supabaseConfigured()) {
    const [prod, cust] = await Promise.all([
      supabaseGet(`products?sku=eq.${encodeURIComponent(r.product_sku)}&select=name&limit=1`),
      r.customer_id ? supabaseGet(`customers?id=eq.${encodeURIComponent(r.customer_id)}&select=name&limit=1`) : null,
    ]);
    productName = prod?.[0]?.name || productName;
    customerName = cust?.[0]?.name || "";
  }
  const edited = type === "UPDATE";
  const text = [r.title ? `“${r.title}”` : "", r.body || ""].filter(Boolean).join("\n\n") || "(rating only, no comment)";

  return supportEmail({
    subject: `⭐ New review to moderate — ${productName} (${r.rating}/5)${edited ? " · edited" : ""}`,
    heading: edited ? "Edited review to moderate" : "New review to moderate",
    rows: [
      ["Product", `${productName} (${r.product_sku})`],
      ["Rating", `${STARS(r.rating)}  ${r.rating}/5`],
      ["Customer", customerName],
      ["Delivered order", r.order_id],
      ["Received", lagosTime(edited ? r.updated_at || r.created_at : r.created_at)],
    ].filter(([, v]) => v != null && v !== ""),
    longText: ["Review", text],
    adminPath: "/admin/reviews",
  });
}

/* ------------------------------------------------------------------
   Support forms
   ------------------------------------------------------------------ */

function supportEmail({ subject, heading, rows, longText, adminPath, replyTo }) {
  const { html, text } = notificationEmail({ heading, rows, longText, adminUrl: path(adminPath) });
  return { to: recipientsFromEnv("NOTIFY_SUPPORT_TO", SUPPORT_TO_DEFAULT), subject, html, text, replyTo };
}

/** Every column not already shown, so new columns are never hidden. */
const remainingRows = (r, shown) => Object.entries(r)
  .filter(([k, v]) => !shown.includes(k) && !["id", "updated_at", "admin_note"].includes(k) && v != null && v !== "")
  .map(([k, v]) => [humanise(k), show(v)]);

const SUPPORT = {
  contact_messages: (r) => supportEmail({
    subject: `✉️ New message: ${r.subject || "General enquiry"} — ${r.name || r.email || r.phone}`,
    heading: `New message: ${r.subject || "General enquiry"}`,
    rows: [
      ["Name", r.name],
      ["Email", r.email],
      ["Phone", r.phone],
      ["Subject", r.subject],
      ["Received", lagosTime(r.created_at)],
    ],
    longText: ["Message", r.message || ""],
    adminPath: `/admin/inbox?tab=messages&id=${encodeURIComponent(r.id)}`,
    replyTo: r.email,
  }),

  warranty_claims: (r) => {
    const known = ["customer_name", "customer_phone", "customer_email", "order_id", "product", "reason", "status", "created_at"];
    const customer = r.customer_name || r.name || r.customer_phone || "customer";
    return supportEmail({
      subject: `🛡 Warranty claim — ${customer}`,
      heading: `Warranty claim — ${customer}`,
      rows: [
        ["Customer", r.customer_name],
        ["Phone", r.customer_phone],
        ["Email", r.customer_email],
        ["Order", r.order_id],
        ["Product", r.product],
        ["Status", r.status],
        ...remainingRows(r, [...known, "reason"]),
        ["Received", lagosTime(r.created_at)],
      ].filter(([, v]) => v != null && v !== ""),
      longText: r.reason ? ["Reason", show(r.reason)] : null,
      adminPath: `/admin/warranty/${encodeURIComponent(r.id)}`,
      replyTo: r.customer_email || r.email,
    });
  },

  form_submissions: (r) => {
    const cfg = FORM_TYPES[r.form_type];
    const label = cfg?.title || humanise(String(r.form_type || "form"));
    return supportEmail({
      subject: `📋 New ${label.toLowerCase()} — ${r.name || r.email || r.phone}`,
      heading: `New ${label.toLowerCase()}`,
      rows: [
        ["Form", cfg?.label || r.form_type],
        ["Name", r.name],
        ["Email", r.email],
        ["Phone", r.phone],
        ...submissionDataRows(r.form_type, r.data),
        ["Received", lagosTime(r.created_at)],
      ],
      adminPath: `/admin/inbox?tab=${encodeURIComponent(r.form_type)}&id=${encodeURIComponent(r.id)}`,
      replyTo: r.email,
    });
  },

  newsletter_subscribers: (r) => supportEmail({
    subject: `📋 New newsletter subscriber — ${r.email}`,
    heading: "New newsletter subscriber",
    rows: [
      ["Email", r.email],
      ["Source", r.source],
      ["Topics", Array.isArray(r.topics) ? r.topics.join(", ") : show(r.topics)],
      ["Received", lagosTime(r.created_at)],
    ],
    adminPath: "/admin/inbox?tab=newsletter",
    replyTo: r.email,
  }),
};

/* ------------------------------------------------------------------
   Entry point
   ------------------------------------------------------------------ */

function secretMatches(given) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** table + event → async builder of { to, subject, html, text, replyTo, onFail? }, or null. */
function route(type, table) {
  if (table === "orders" && (type === "INSERT" || type === "UPDATE")) return handleOrder;
  if (table === "reviews" && (type === "INSERT" || type === "UPDATE")) return handleReview;
  if (type !== "INSERT") return null;
  if (table === "whatsapp_quotes") return handleWhatsappQuote;
  const build = SUPPORT[table];
  return build ? async ({ record }) => build(record) : null;
}

export const handler = async (event) => {
  // Netlify lower-cases incoming header names.
  if (!secretMatches(event.headers?.["x-webhook-secret"])) {
    if (!process.env.WEBHOOK_SECRET) console.error("[notify-event] WEBHOOK_SECRET is not set; rejecting all calls");
    return reply(401, { ok: false, error: "Unauthorized" });
  }
  if (event.httpMethod !== "POST") return reply(405, { ok: false, error: "Method not allowed" });

  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return reply(413, { ok: false, error: "Payload too large" });

  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return reply(400, { ok: false, error: "Invalid JSON body" });
  }

  const { type, table, record } = payload;
  const handle = route(type, table);
  if (!handle || !record || typeof record !== "object") {
    console.log("[notify-event] ignored", { type, table });
    return reply(200, { ok: true, skipped: true, reason: "not_handled" });
  }

  // Check Resend before anything else, so an order is never marked
  // notified without an email going out.
  const missing = missingResendConfig();
  if (missing.length) {
    console.warn(`[notify-event] not configured (${missing.join(", ")}); no email for ${table} ${record.id}`);
    return reply(200, { ok: true, skipped: true, reason: "not_configured" });
  }

  let mail;
  try {
    mail = await handle(payload);
  } catch (err) {
    console.error(`[notify-event] ${table} ${record.id} failed:`, err.message);
    return reply(200, { ok: false, error: "lookup_failed" });
  }
  if (mail.skipped) return reply(200, { ok: true, skipped: true, reason: mail.skipped });
  if (mail.notConfigured) {
    console.warn(`[notify-event] not configured (${mail.notConfigured}); no email for ${table} ${record.id}`);
    return reply(200, { ok: true, skipped: true, reason: "not_configured" });
  }
  if (!mail.to.length) {
    console.warn(`[notify-event] no valid recipients for ${table}`);
    return reply(200, { ok: true, skipped: true, reason: "no_recipients" });
  }

  const sent = await sendViaResend({
    to: mail.to,
    subject: subjectLine(mail.subject),
    html: mail.html,
    text: mail.text,
    replyTo: isValidEmail(mail.replyTo) ? mail.replyTo : undefined,
  });
  if (!sent.ok) {
    console.error(`[notify-event] Resend error for ${table} ${record.id}:`, sent.status, sent.error);
    if (mail.onFail) await mail.onFail().catch((err) => console.error("[notify-event] release failed:", err.message));
    // Still 2xx: Supabase has nothing to retry; the error is in the logs.
    return reply(200, { ok: false, error: "email_provider_error" });
  }
  console.log("[notify-event] sent", { table, id: record.id, emailId: sent.id });
  return reply(200, { ok: true, id: sent.id });
};
