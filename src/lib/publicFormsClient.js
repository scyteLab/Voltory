import { supabase } from "./supabaseClient.js";

/**
 * publicFormsClient — storefront side of the public forms backend
 * (supabase/forms_backend.sql).
 *
 *   · submitFormSubmission — Installation / Affiliate / Careers → form_submissions
 *   · subscribeNewsletter  — Footer / Blog → newsletter_subscribers
 *
 * Anon may INSERT only, so we never .select() the row back.
 * Notification emails are sent by a Supabase Database Webhook,
 * never from the browser.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_RE.test(String(email || "").trim());
}

/** Trim a string and cap its length; empty → null. */
export function clip(value, max) {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Resolves { ok: true } or { ok: false, reason: "rate_limited" | "error", error }.
 * `data` holds every form-specific field (short strings only).
 */
export async function submitFormSubmission({ formType, name, email, phone, data = {} }) {
  try {
    const { error } = await supabase.from("form_submissions").insert({
      form_type: formType,
      name: clip(name, 120),
      email: clip(email, 254)?.toLowerCase() || null,
      phone: clip(phone, 40),
      data,
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error(`[forms] ${formType} insert failed:`, error);
      const rateLimited = /rate_limited/.test(error.message || "");
      return { ok: false, reason: rateLimited ? "rate_limited" : "error", error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "error", error: err?.message || String(err) };
  }
}

/**
 * Resolves { ok: true } on a new signup, { ok: true, duplicate: true }
 * when the address is already on the list, { ok: false, reason } otherwise.
 */
export async function subscribeNewsletter({ email, source = "footer", topics = [] }) {
  const clean = String(email || "").trim().toLowerCase();
  if (!isValidEmail(clean) || clean.length > 254) return { ok: false, reason: "invalid" };
  try {
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email: clean,
      source,
      topics: topics.slice(0, 20),
    });
    if (error) {
      // Unique index on email: already subscribed is not an error for the visitor.
      if (error.code === "23505") return { ok: true, duplicate: true };
      // eslint-disable-next-line no-console
      console.error("[newsletter] insert failed:", error);
      return { ok: false, reason: "error", error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: "error", error: err?.message || String(err) };
  }
}

/** Human reference shown to the visitor and stored in data.reference:
 *  <prefix>-YYYYMMDDHHmm-XXXX (e.g. VLT-I-202611021430-K3QZ). */
export function makeReference(prefix) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${suffix}`;
}
