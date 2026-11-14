import { AUTH_ERROR_MESSAGES, checkPassword } from "./authRules.js";
import { validateNgPhone } from "../utils/phone.js";

/**
 * customerAuth.js  —  storefront customer auth (thin client)
 *
 * Everything runs in the customer-auth Netlify function (Phase 2 of
 * docs/CUSTOMER_AUTH_LOCKDOWN_PLAN.md): bcrypt, rate limits and
 * sessions are on the server. The session is an HttpOnly cookie
 * (naven_session) that this code can't read; the browser never touches
 * customers, customer_sessions or customer_credentials.
 *
 * Public API (unchanged, used by AuthContext):
 *   getCurrentCustomer()
 *   signUp({ phone, password, name, email? })   → { ok, customer, earlierGuestOrders } | { ok:false, error }
 *   signIn({ phone, password })                 → { ok, customer } | { ok:false, error }
 *   signOutCurrent()
 *   getSessionToken()                           LEGACY header token (see below)
 *   clearLegacySession()
 *   updateProfile(patch)                        → { ok, customer } | { ok:false, error }
 *   changePassword({ currentPassword, newPassword }) → { ok, revokedOtherSessions }
 *
 * LEGACY (delete after STEP B): sessions minted by the old browser
 * code live in localStorage "voltory_customer_session" and are sent as
 * X-Customer-Session until Step B deletes them. A cookie sign-in, a
 * sign-up or a sign-out clears that token.
 */

const ENDPOINT = "/.netlify/functions/customer-auth";
const LEGACY_SESSION_KEY = "voltory_customer_session";
// Not a secret: only "this device signed in", so anonymous visitors
// don't call customer-auth on every page load. The cookie decides.
const HINT_KEY = "naven_signed_in";

const store = (fn) => { try { return fn(localStorage); } catch { return null; } };
const setHint = (on) => store((ls) => (on ? ls.setItem(HINT_KEY, "1") : ls.removeItem(HINT_KEY)));
const hasHint = () => store((ls) => ls.getItem(HINT_KEY) === "1");

/** True when this device has a (probably live) session: the hint, or a LEGACY token. */
export const isProbablySignedIn = () => Boolean(hasHint() || getSessionToken());

/** Fired on any 401 from the customer functions; AuthContext signs out locally. */
export const UNAUTHORIZED_EVENT = "naven:unauthorized";
export function notifyUnauthorized() {
  setHint(false);
  clearLegacySession();
  try { window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)); } catch { /* not in a browser */ }
}

/* ============================================================
   LEGACY header token (delete after Step B)
   ============================================================ */

export function getSessionToken() {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(LEGACY_SESSION_KEY) : null;
  } catch {
    return null;
  }
}

export function clearLegacySession() {
  try { localStorage.removeItem(LEGACY_SESSION_KEY); } catch { /* storage blocked */ }
}

/* ============================================================
   Transport
   ============================================================ */

/** POST to customer-auth. Never throws: { status, data } (status 0 = offline / no function). */
async function call(action, payload = {}) {
  const headers = { "Content-Type": "application/json" };
  const legacy = getSessionToken();
  if (legacy) headers["X-Customer-Session"] = legacy;   // LEGACY (delete after Step B)
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json().catch(() => null);
    if (!data) return { status: 0, data: null };
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  }
}

function failure(status, data, fallback = "Something went wrong. Please try again.") {
  const code = data?.error || (status === 0 ? "offline" : status === 429 ? "rate_limited" : "server_error");
  return { ok: false, status, code, error: AUTH_ERROR_MESSAGES[code] || fallback };
}

const phoneError = (phone) => {
  const r = validateNgPhone(phone);
  return r.ok ? null : r.error;
};

/* ============================================================
   API
   ============================================================ */

/** The signed-in customer, or null (no / expired / revoked session). */
export async function getCurrentCustomer() {
  if (!hasHint() && !getSessionToken()) return null;
  const { status, data } = await call("me");
  if (status === 200 && data?.ok) {
    setHint(true);
    if (data.via === "cookie") clearLegacySession();
    return data.customer || null;
  }
  if (status === 401) { setHint(false); clearLegacySession(); }
  return null;
}

export async function signUp({ phone, password, name, email }) {
  const pErr = phoneError(phone);
  if (pErr) return { ok: false, error: pErr };
  const pwErr = checkPassword(password);
  if (pwErr) return { ok: false, error: AUTH_ERROR_MESSAGES[pwErr] };
  if (!name?.trim()) return { ok: false, error: AUTH_ERROR_MESSAGES.name_required };

  const { status, data } = await call("signup", { phone, password, name, email: email || null });
  if (status === 200 && data?.ok) {
    clearLegacySession();
    setHint(true);
    return { ok: true, customer: data.customer, earlierGuestOrders: Boolean(data.earlierGuestOrders) };
  }
  return failure(status, data, "Couldn't create your account. Please try again.");
}

export async function signIn({ phone, password }) {
  const pErr = phoneError(phone);
  if (pErr) return { ok: false, error: pErr };
  if (!password) return { ok: false, error: AUTH_ERROR_MESSAGES.password_required };

  const { status, data } = await call("signin", { phone, password });
  if (status === 200 && data?.ok) {
    clearLegacySession();
    setHint(true);
    return { ok: true, customer: data.customer };
  }
  if (status === 429) {
    return { ok: false, code: "rate_limited", error: "Too many failed sign-in attempts. Please try again in 15 minutes." };
  }
  return failure(status, data, "Sign-in failed. Please try again.");
}

export async function signOutCurrent() {
  await call("signout");
  clearLegacySession();
  setHint(false);
  return { ok: true };
}

export async function updateProfile(patch) {
  const { status, data } = await call("update-profile", patch);
  if (status === 200 && data?.ok) return { ok: true, customer: data.customer };
  if (status === 401) notifyUnauthorized();
  return failure(status, data);
}

export async function changePassword({ currentPassword, newPassword }) {
  const pwErr = checkPassword(newPassword);
  if (pwErr) return { ok: false, error: AUTH_ERROR_MESSAGES[pwErr] };
  const { status, data } = await call("change-password", { currentPassword, newPassword });
  if (status === 200 && data?.ok) return { ok: true, revokedOtherSessions: data.revokedOtherSessions || 0 };
  if (status === 401) notifyUnauthorized();
  return failure(status, data);
}
