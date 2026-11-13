import bcrypt from "bcryptjs";
import { supabase } from "./supabaseClient.js";
import { normaliseNgPhone, validateNgPhone } from "../utils/phone.js";

/**
 * customerAuth.js  \u2014  storefront customer auth (password-based)
 *
 * Pivoted from OTP to phone + password.
 * Reasons documented in the accompanying session README.
 *
 * Public API:
 *   getCurrentCustomer()
 *   signUp({ phone, password, name, email? })
 *   signIn({ phone, password })
 *   signOutCurrent()
 *   getSessionToken()
 *   updateProfile(patch)
 *   changePassword({ currentPassword, newPassword })
 *
 * Session model unchanged from OTP era:
 *   \u00B7 On successful sign-in/up, we mint a session token
 *   \u00B7 Token stored in localStorage under SESSION_KEY
 *   \u00B7 Token \u2194 customer_id row in `customer_sessions` table
 *   \u00B7 30-day expiry
 *
 * Security notes (honest, documented tradeoffs):
 *   \u00B7 Passwords hashed client-side with bcrypt (10 rounds).
 *     This reveals the hashing algorithm to attackers but avoids
 *     a serverless function for launch. Migration to server-side
 *     hashing is a future hardening pass.
 *   \u00B7 Rate limiting on sign-in: max 5 attempts per phone per
 *     15 minutes. Blocks brute-force attempts at the app layer.
 *   \u00B7 Minimum password length: 6 characters. Deliberately low
 *     to reduce friction for Nigerian customers; brute-force
 *     defense comes from rate limiting, not password complexity.
 *   \u00B7 No email verification. Email is optional and only used
 *     for password reset (future). Not a security anchor.
 */

const SESSION_KEY  = "voltory_customer_session";
const BCRYPT_COST  = 10;
const MIN_PASSWORD = 6;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MIN  = 15;

/* ============================================================
   Helpers
   ============================================================ */

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

async function comparePassword(plaintext, hash) {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false;
  }
}

// Canonical "08012345678" (see utils/phone.js); "" when invalid.
function normalizePhone(phone) {
  return normaliseNgPhone(phone) || "";
}

/**
 * Look a customer up by canonical phone. A few older rows store
 * "+234…", so both spellings are matched; a row with a password wins.
 */
async function findCustomerByPhone(phone, columns) {
  const { data, error } = await supabase
    .from("customers")
    .select(columns)
    .in("phone", [phone, "+234" + phone.slice(1)])
    .limit(2);
  if (error) return { data: null, error };
  const rows = data || [];
  return { data: rows.find((r) => r.password_hash) || rows[0] || null, error: null };
}

function validatePassword(pw) {
  if (!pw || typeof pw !== "string") return "Password is required.";
  if (pw.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`;
  return null;
}

function validatePhone(phone) {
  const res = validateNgPhone(phone);
  return res.ok ? null : res.error;
}

/* ============================================================
   Sign up  \u2014  create account with phone + password
   ============================================================ */

export async function signUp({ phone, password, name, email }) {
  const phoneErr = validatePhone(phone);
  if (phoneErr) return { ok: false, error: phoneErr };

  const pwErr = validatePassword(password);
  if (pwErr) return { ok: false, error: pwErr };

  if (!name?.trim()) return { ok: false, error: "Name is required." };

  const normalizedPhone = normalizePhone(phone);
  const cleanEmail = email?.trim() ? email.trim().toLowerCase() : null;

  try {
    /* Check if phone already registered with a password */
    const { data: existing, error: findErr } = await findCustomerByPhone(normalizedPhone, "id, password_hash");

    if (findErr) return { ok: false, error: findErr.message };

    if (existing?.password_hash) {
      return { ok: false, error: "An account with this phone number already exists. Please sign in." };
    }

    const passwordHash = await hashPassword(password);

    let customer;
    if (existing) {
      /* Phone exists (from guest checkout) but no password \u2014
         upgrade the existing row rather than duplicate */
      const { data, error } = await supabase
        .from("customers")
        .update({
          password_hash: passwordHash,
          name:  name.trim(),
          email: cleanEmail,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      customer = data;
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          phone: normalizedPhone,
          password_hash: passwordHash,
          name:  name.trim(),
          email: cleanEmail,
        })
        .select()
        .single();
      if (error) return { ok: false, error: error.message };
      customer = data;
    }

    const sessRes = await mintSession(customer.id);
    if (!sessRes.ok) return sessRes;

    return { ok: true, customer };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   Sign in  \u2014  phone + password
   ============================================================ */

export async function signIn({ phone, password }) {
  const phoneErr = validatePhone(phone);
  if (phoneErr) return { ok: false, error: phoneErr };
  if (!password) return { ok: false, error: "Password is required." };

  const normalizedPhone = normalizePhone(phone);

  try {
    /* Rate limit: count recent failed attempts for this phone.
       We reuse customer_otp_challenges as a lightweight attempts
       log (repurposed \u2014 the `purpose` column now stores
       'login_fail' rows). No new table needed. */
    const rateCutoff = new Date(Date.now() - LOCKOUT_MIN * 60 * 1000).toISOString();

    const { count } = await supabase
      .from("customer_otp_challenges")
      .select("id", { count: "exact", head: true })
      .eq("phone", normalizedPhone)
      .eq("purpose", "login_fail")
      .gt("created_at", rateCutoff);

    if (count != null && count >= MAX_LOGIN_ATTEMPTS) {
      return {
        ok: false,
        error: `Too many failed sign-in attempts. Try again in ${LOCKOUT_MIN} minutes.`,
      };
    }

    /* Fetch customer */
    const { data: customer, error: findErr } = await findCustomerByPhone(normalizedPhone, "*");

    if (findErr) return { ok: false, error: findErr.message };

    if (!customer) {
      /* Log failed attempt to defeat username enumeration */
      logFailedAttempt(normalizedPhone);
      return { ok: false, error: "Invalid phone number or password." };
    }

    if (!customer.password_hash) {
      /* Legacy customer (from guest checkout or OTP era) \u2014
         has phone but never set a password. Prompt to sign up. */
      return {
        ok: false,
        error: "This phone number has never been used to create an account. Please sign up.",
        needsSignup: true,
      };
    }

    const passwordOk = await comparePassword(password, customer.password_hash);
    if (!passwordOk) {
      logFailedAttempt(normalizedPhone);
      const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - (count || 0) - 1);
      return {
        ok: false,
        error: remaining > 0
          ? `Invalid phone number or password. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
          : `Too many failed sign-in attempts. Try again in ${LOCKOUT_MIN} minutes.`,
      };
    }

    /* Success \u2014 clean up any failed-attempt log rows for this
       phone so future attempts start fresh */
    supabase
      .from("customer_otp_challenges")
      .delete()
      .eq("phone", normalizedPhone)
      .eq("purpose", "login_fail")
      .then(() => {}, () => {});

    const sessRes = await mintSession(customer.id);
    if (!sessRes.ok) return sessRes;

    return { ok: true, customer };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Fire-and-forget log of a failed login attempt.
 * Reuses customer_otp_challenges as an attempts tracker to
 * avoid a new table for launch.
 */
function logFailedAttempt(phone) {
  const expiresAt = new Date(Date.now() + LOCKOUT_MIN * 60 * 1000).toISOString();
  supabase
    .from("customer_otp_challenges")
    .insert({
      phone,
      code_hash: "login_fail",
      purpose:   "login_fail",
      attempts:  1,
      expires_at: expiresAt,
    })
    .then(() => {}, () => {});
}

/* ============================================================
   Session management
   ============================================================ */

/**
 * The current session token (Phase 1 of the lockdown plan sends it to
 * the customer-data function as X-Customer-Session). Phase 2 replaces
 * this with an HttpOnly cookie the page can't read.
 */
export function getSessionToken() {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
  } catch {
    return null;
  }
}

async function mintSession(customerId) {
  try {
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("customer_sessions")
      .insert({ customer_id: customerId, token, expires_at: expiresAt });
    if (error) return { ok: false, error: error.message };

    localStorage.setItem(SESSION_KEY, token);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function getCurrentCustomer() {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
  if (!token) return null;

  try {
    const { data: session } = await supabase
      .from("customer_sessions")
      .select("customer_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!session || new Date(session.expires_at).getTime() < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const { data: customer } = await supabase
      .from("customers")
      .select("*")
      .eq("id", session.customer_id)
      .maybeSingle();

    return customer || null;
  } catch (err) {
    console.warn("[customerAuth] getCurrentCustomer threw:", err);
    return null;
  }
}

export async function signOutCurrent() {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(SESSION_KEY) : null;
  if (!token) return { ok: true };

  try {
    await supabase.from("customer_sessions").delete().eq("token", token);
  } catch (err) {
    console.warn("[customerAuth] signOutCurrent threw:", err);
  }
  localStorage.removeItem(SESSION_KEY);
  return { ok: true };
}

/* ============================================================
   Profile + password updates
   ============================================================ */

export async function updateProfile(patch) {
  const current = await getCurrentCustomer();
  if (!current) return { ok: false, error: "Not signed in." };

  /* Don't allow arbitrary password_hash overwrites via this path */
  const safe = { ...patch };
  delete safe.password_hash;
  delete safe.id;
  delete safe.phone;

  try {
    const { data, error } = await supabase
      .from("customers")
      .update(safe)
      .eq("id", current.id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, customer: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function changePassword({ currentPassword, newPassword }) {
  const current = await getCurrentCustomer();
  if (!current) return { ok: false, error: "Not signed in." };

  const pwErr = validatePassword(newPassword);
  if (pwErr) return { ok: false, error: pwErr };

  try {
    const ok = await comparePassword(currentPassword, current.password_hash);
    if (!ok) return { ok: false, error: "Current password is incorrect." };

    const newHash = await hashPassword(newPassword);
    const { error } = await supabase
      .from("customers")
      .update({ password_hash: newHash })
      .eq("id", current.id);
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}