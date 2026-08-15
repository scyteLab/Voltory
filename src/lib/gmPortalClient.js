import { generateSecret, generateURI, verifySync } from "otplib";
import { supabase } from "./supabaseClient.js";

/**
 * gmPortalClient  \u2014  GM Approvals Portal client helpers
 *
 * Handles:
 *   \u00B7 Reading admin role from admin_roles
 *   \u00B7 TOTP secret generation, enrollment, verification
 *   \u00B7 Approvals table CRUD (list, create, decide)
 *
 * Honest limitations of this implementation:
 *
 *   \u00B7 TOTP secret is stored plaintext in the DB. Anyone with
 *     database read access can bypass TOTP by adding the secret
 *     to their own authenticator app. Primary defense is
 *     Supabase RLS + service-role separation; a stronger fix
 *     later would use Supabase Vault or a Netlify function.
 *
 *   \u00B7 TOTP verification runs client-side. A malicious admin
 *     with dev-tools access could bypass by editing JS.
 *     Defense-in-depth would require server-side verification
 *     via a Netlify function \u2014 a hardening pass for later.
 *
 * These limitations are acceptable for a first launch given the
 * threat model (staff might mess around, not sophisticated
 * attackers). Documented so future-us knows what to harden.
 */

/* ============================================================
   Role fetching
   ============================================================ */

/**
 * Fetch the admin_roles row for a given user id.
 * Returns null if the user has no role row (i.e. not admin, or
 * is a Supabase Auth user who was created before admin_roles
 * existed \u2014 in which case they can still sign in but have no
 * portal access).
 */
export async function fetchAdminRole(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("admin_roles")
      .select("role, totp_enrolled_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[gm-portal] fetchAdminRole failed:", error.message);
      return null;
    }
    return data; // { role, totp_enrolled_at } or null
  } catch (err) {
    console.warn("[gm-portal] fetchAdminRole threw:", err);
    return null;
  }
}

/* ============================================================
   TOTP enrollment
   ============================================================ */

/**
 * Generate a fresh TOTP secret + otpauth URL for a GM to enroll.
 * Does NOT save to DB \u2014 caller must call confirmTotpEnrollment
 * after the GM proves possession by entering a valid code.
 *
 * Returns:
 *   {
 *     secret: 'BASE32SECRET...',
 *     otpauthUrl: 'otpauth://totp/NAVEN Admin:gm@mynaven.com?secret=...&issuer=NAVEN%20Admin'
 *   }
 *
 * The otpauthUrl gets rendered as a QR code the GM scans with
 * Google Authenticator (or any TOTP app).
 */
export function generateTotpSecret(gmEmail) {
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: "NAVEN Admin",
    label: gmEmail || "gm@mynaven.com",
    secret,
  });
  return { secret, otpauthUrl };
}

/**
 * Verify a 6-digit TOTP code against a candidate secret. Used
 * during enrollment to confirm the GM's authenticator is in
 * sync BEFORE we save the secret to the DB. If the GM types
 * the code wrong here, nothing gets saved and they can restart.
 */
export function verifyTotpCode(secret, code) {
  if (!secret || !code) return false;
  try {
    // epochTolerance: 30 accepts the previous/next 30-second window
    // too, matching otplib v11's old default window-of-1 behavior
    // (handles small clock skew between the GM's phone and this device).
    const result = verifySync({ secret, token: String(code).trim(), epochTolerance: 30 });
    return result.valid;
  } catch (err) {
    console.warn("[gm-portal] verifyTotpCode threw:", err);
    return false;
  }
}

/**
 * Save the confirmed TOTP secret to the GM's admin_roles row
 * and set totp_enrolled_at. Only call this AFTER verifyTotpCode
 * returned true.
 */
export async function confirmTotpEnrollment(userId, secret) {
  try {
    const { error } = await supabase
      .from("admin_roles")
      .update({
        totp_secret: secret,
        totp_enrolled_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Fetch the GM's saved TOTP secret (needed to verify unlock
 * attempts). Returns null if the GM hasn't enrolled yet.
 */
export async function fetchTotpSecret(userId) {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from("admin_roles")
      .select("totp_secret, totp_enrolled_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    if (!data.totp_secret) return null;
    return data.totp_secret;
  } catch (err) {
    console.warn("[gm-portal] fetchTotpSecret threw:", err);
    return null;
  }
}

/* ============================================================
   Approvals queue (used in sub-session 2)
   ============================================================ */

/**
 * List approvals filtered by status. Ordered newest first.
 * Sub-session 2's queue UI uses this.
 */
export async function listApprovals(status = "pending") {
  try {
    const { data, error } = await supabase
      .from("approvals")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message, rows: [] };
    return { ok: true, rows: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), rows: [] };
  }
}

/**
 * Insert a new approval request. Sub-session 2 wires 4 action
 * types to call this instead of executing directly.
 */
export async function createApproval({ actionType, payload, createdBy }) {
  try {
    const { data, error } = await supabase
      .from("approvals")
      .insert({
        action_type: actionType,
        payload,
        created_by: createdBy,
      })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, approval: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Approve or reject an approval. Enforces two-person integrity
 * at the client level: decider must differ from creator.
 * (Not a hard security guarantee \u2014 real enforcement would need
 * a policy or a serverless function \u2014 but catches accidents.)
 */
export async function decideApproval({ id, decision, decidedBy, reason }) {
  if (!["approved", "rejected"].includes(decision)) {
    return { ok: false, error: "Invalid decision." };
  }
  try {
    // Two-person integrity check
    const { data: existing, error: fetchErr } = await supabase
      .from("approvals")
      .select("created_by, status")
      .eq("id", id)
      .single();
    if (fetchErr) return { ok: false, error: fetchErr.message };
    if (existing.status !== "pending") {
      return { ok: false, error: `Approval already ${existing.status}.` };
    }
    if (existing.created_by === decidedBy) {
      return { ok: false, error: "You cannot decide on your own proposal." };
    }

    const { error } = await supabase
      .from("approvals")
      .update({
        status: decision,
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
        reason: reason || null,
      })
      .eq("id", id)
      .eq("status", "pending"); // race guard
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}