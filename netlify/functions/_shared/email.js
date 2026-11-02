/**
 * Shared Resend + Supabase helpers for send-email and
 * notify-new-submission. Lives in _shared so Netlify bundles it into
 * those functions instead of deploying it as a function of its own.
 *
 * Env vars (Netlify dashboard → Site settings → Environment variables):
 *   RESEND_API_KEY             — from https://resend.com/api-keys
 *   RESEND_FROM_EMAIL          — verified sender, e.g. "NAVEN <noreply@mynaven.com>"
 *   NOTIFY_EMAILS              — team recipients, comma-separated
 *   RESEND_ADMIN_EMAIL         — legacy single recipient, used if NOTIFY_EMAILS is unset
 *   SUPABASE_URL               — falls back to VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  — bypasses RLS; server-side only
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value.trim());
}

/** Team recipients from NOTIFY_EMAILS (comma-separated), else RESEND_ADMIN_EMAIL. */
export function teamRecipients() {
  const raw = process.env.NOTIFY_EMAILS || process.env.RESEND_ADMIN_EMAIL || "";
  return raw.split(",").map((s) => s.trim()).filter(isValidEmail);
}

/** Missing Resend settings, by name (empty when ready to send). */
export function missingResendConfig() {
  const missing = [];
  if (!process.env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!process.env.RESEND_FROM_EMAIL) missing.push("RESEND_FROM_EMAIL");
  return missing;
}

/**
 * Send one email through Resend. Resolves { ok, id } or
 * { ok: false, status, error }. Never throws.
 */
export async function sendViaResend({ to, subject, html, text, replyTo }) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ""),
        ...(isValidEmail(replyTo) ? { reply_to: replyTo.trim() } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, error: data.message || data.error || "Resend API error" };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, status: 500, error: err?.message || String(err) };
  }
}

export function supabaseConfigured() {
  return Boolean((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** GET from PostgREST with the service key. Throws on HTTP errors. */
export async function supabaseGet(path) {
  const base = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Supabase GET ${path.split("?")[0]} failed: HTTP ${res.status} ${json?.message || ""}`.trim());
  }
  return json;
}

/** Public site origin for links in emails: SITE_URL, else Netlify's URL. */
export function siteOrigin() {
  return (process.env.SITE_URL || process.env.URL || "https://mynaven.com").replace(/\/$/, "");
}
