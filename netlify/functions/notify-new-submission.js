/**
 * notify-new-submission  —  Netlify serverless function
 *
 * Called by Supabase Database Webhooks (Dashboard → Database →
 * Webhooks), one per table, on INSERT:
 *
 *   contact_messages · form_submissions · newsletter_subscribers · warranty_claims
 *
 * The database triggers the email, not the browser: a row that was
 * saved always produces one notification, and visitors can't make
 * this function send anything (it only accepts calls carrying the
 * shared secret).
 *
 * Supabase sends:  { type: "INSERT", table, schema, record, old_record }
 * with our header  x-webhook-secret: <WEBHOOK_SECRET>
 *
 * Env vars (Netlify):
 *   WEBHOOK_SECRET     — required; anything without it gets 401
 *   NOTIFY_EMAILS      — comma-separated recipients, e.g. business@mynaven.com
 *   RESEND_API_KEY, RESEND_FROM_EMAIL
 *   SITE_URL           — optional; for the "Open in admin" link
 *                        (defaults to Netlify's own URL)
 *
 * Missing Resend / recipient settings are logged and answered with
 * 200: the row is already saved and nothing should retry.
 *
 * Adding orders later: add an `orders` entry to SOURCES (heading,
 * rows, adminPath) and point one more webhook (orders, INSERT) here.
 */
import { timingSafeEqual } from "node:crypto";
import { submissionNotifyEmail } from "../../src/lib/emailTemplates.js";
import { FORM_TYPES, submissionDataRows } from "../../src/config/formTypes.js";
import {
  isValidEmail, missingResendConfig, sendViaResend, siteOrigin, teamRecipients,
} from "./_shared/email.js";

const headers = { "Content-Type": "application/json" };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

const lagosTime = (iso) =>
  `${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short",
  }).format(iso ? new Date(iso) : new Date())} (Lagos)`;

const humanise = (key) => key.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/**
 * One entry per table. Each returns the email parts for a new row:
 *   heading, rows [[label, value]], longText? [label, value],
 *   adminPath, replyTo?
 */
const SOURCES = {
  contact_messages: (r) => ({
    heading: `New contact message: ${r.subject || "General enquiry"}`,
    rows: [
      ["Form", "Contact"],
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

  form_submissions: (r) => {
    const cfg = FORM_TYPES[r.form_type];
    return {
      heading: `New ${(cfg?.title || r.form_type).toLowerCase()}`,
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
    };
  },

  newsletter_subscribers: (r) => ({
    heading: "New newsletter subscriber",
    rows: [
      ["Form", "Newsletter"],
      ["Email", r.email],
      ["Source", r.source],
      ["Topics", Array.isArray(r.topics) ? r.topics.join(", ") : ""],
      ["Received", lagosTime(r.created_at)],
    ],
    adminPath: "/admin/inbox?tab=newsletter",
    replyTo: r.email,
  }),

  // Column set isn't fixed in this repo's SQL, so show every field.
  warranty_claims: (r) => ({
    heading: "New warranty claim",
    rows: [
      ["Form", "Warranty claim"],
      ...Object.entries(r)
        .filter(([k, v]) => !["id", "created_at", "updated_at", "admin_note"].includes(k) && v != null && v !== "")
        .map(([k, v]) => [humanise(k), typeof v === "object" ? JSON.stringify(v) : String(v)]),
      ["Received", lagosTime(r.created_at)],
    ],
    adminPath: `/admin/warranty/${encodeURIComponent(r.id)}`,
    replyTo: r.customer_email || r.email,
  }),
};

function secretMatches(given) {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const handler = async (event) => {
  // Netlify lower-cases incoming header names.
  if (!secretMatches(event.headers?.["x-webhook-secret"])) {
    if (!process.env.WEBHOOK_SECRET) console.error("[notify] WEBHOOK_SECRET is not set; rejecting all calls");
    return reply(401, { ok: false, error: "Unauthorized" });
  }
  if (event.httpMethod !== "POST") return reply(405, { ok: false, error: "Method not allowed" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { ok: false, error: "Invalid JSON body" });
  }

  const { type, table, record } = payload;
  const build = SOURCES[table];
  if (type !== "INSERT" || !build || !record) {
    console.warn("[notify] ignored webhook", { type, table });
    return reply(200, { ok: true, skipped: true, reason: "not_handled" });
  }

  const missing = missingResendConfig();
  const to = teamRecipients();
  if (!to.length) missing.push("NOTIFY_EMAILS");
  if (missing.length) {
    console.warn(`[notify] not configured (${missing.join(", ")}); no email for ${table} ${record.id}`);
    return reply(200, { ok: true, skipped: true, reason: "not_configured" });
  }

  const parts = build(record);
  const adminUrl = `${siteOrigin()}${parts.adminPath}`;
  const who = record.name || record.email || record.customer_name || "";
  const { html, text } = submissionNotifyEmail({
    heading: parts.heading,
    preheader: who ? `From ${who}` : parts.heading,
    rows: parts.rows,
    longText: parts.longText,
    adminUrl,
  });

  const sent = await sendViaResend({
    to,
    subject: `[NAVEN] ${parts.heading}${who ? ` from ${who}` : ""}`.replace(/[\r\n]+/g, " ").slice(0, 200),
    html,
    text,
    replyTo: isValidEmail(parts.replyTo) ? parts.replyTo : undefined,
  });
  if (!sent.ok) {
    // Shows in Supabase's webhook log (net._http_response) and Netlify logs.
    console.error(`[notify] Resend error for ${table} ${record.id}:`, sent.status, sent.error);
    return reply(502, { ok: false, error: "Email provider error" });
  }
  console.log("[notify] sent", { table, id: record.id, emailId: sent.id });
  return reply(200, { ok: true, id: sent.id });
};
