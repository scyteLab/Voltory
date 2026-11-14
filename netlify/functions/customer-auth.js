/**
 * customer-auth  —  Netlify function (SERVICE ROLE)
 *
 * Phase 2 of docs/CUSTOMER_AUTH_LOCKDOWN_PLAN.md: customer sign-up,
 * sign-in, sessions and profile run on the server. The browser never
 * sees a password hash and never touches customers / customer_sessions
 * / customer_credentials.
 *
 * Request: POST /.netlify/functions/customer-auth, Content-Type:
 * application/json, allowed Origin (CSRF guard; plus SameSite=Lax).
 * `me` may also be a GET.
 *
 *   { action: "signup", phone, password, name, email? }
 *       → 200 { customer, earlierGuestOrders } + session cookie
 *   { action: "signin", phone, password }
 *       → 200 { customer } + session cookie | 401 invalid_credentials
 *         (same answer for an unknown phone and a wrong password, with a
 *         dummy bcrypt compare so the timing matches)
 *   { action: "signout" }                       → 200, cookie cleared
 *   { action: "me" }                            → 200 { customer } | 401
 *   { action: "change-password", currentPassword, newPassword }
 *       → 200 { revokedOtherSessions } (every OTHER session is deleted)
 *   { action: "update-profile", name?, email?, gender?, dob?, marketing_opt_in? }
 *       → 200 { customer } (whitelist; phone / id / hash never change)
 *
 * Passwords: bcrypt cost 10, ≥ 8 characters, stored only in
 * customer_credentials. claimed_at (see _shared/orderOwnership.js):
 * sign-up time for new accounts. Accounts that had a password before
 * Phase 2 were migrated by STEP B-0 with claimed_at = created_at. A
 * hash found ONLY in customers.password_hash at sign-in (written by the
 * old browser code after B-0, or forged through the anon key before
 * Step B) is copied with claimed_at = now, so it can't unlock older
 * order history.
 *
 * Rate limits (_shared/rateLimit.js, HMAC keys, AUTH_PEPPER):
 *   sign-in failures   5 / 15 min per phone, 20 / 15 min per IP
 *   sign-up attempts   3 / hour per phone,  5 / hour per IP
 *   wrong current password on change-password  5 / 15 min per customer
 *
 * Sessions + cookie: _shared/customerSession.js.
 */
import bcrypt from "bcryptjs";
import { normaliseNgPhone } from "../../src/utils/phone.js";
import { checkEmail, checkName, checkPassword, checkProfilePatch } from "../../src/lib/authRules.js";
import { createRest, serviceDbConfigured } from "./_shared/serviceDb.js";
import {
  RateLimitConfigError, clientIp, createRateLimiter, restAttemptStore, tooManyRequests,
} from "./_shared/rateLimit.js";
import {
  SESSION_MAX_AGE, clearSessionCookie, cookieToken, createSessionResolver, hashToken, header,
  newSessionToken, sessionCookie,
} from "./_shared/customerSession.js";
import { CUSTOMER_PUBLIC_COLUMNS, restDb } from "./_shared/customerRestDb.js";
import { phoneSpellings, readJsonPost, reply } from "./_shared/http.js";

const MAX_BODY = 4 * 1024;
export const BCRYPT_COST = 10;
// bcrypt hash of a random throw-away password: unknown phones are compared
// against it so they take as long as a wrong password.
const DUMMY_HASH = "$2b$10$3HbnivXvqoLIUnTFXZedR.4e.jU9Zn7tOJF8k3vs0pqrEdwG.qJlq";

export const LIMITS = {
  signinPhone: { kind: "signin", limit: 5, windowSec: 15 * 60 },
  signinIp: { kind: "signin", limit: 20, windowSec: 15 * 60 },
  signupPhone: { kind: "signup", limit: 3, windowSec: 60 * 60, countAll: true },
  signupIp: { kind: "signup", limit: 5, windowSec: 60 * 60, countAll: true },
  changePassword: { kind: "change_password", limit: 5, windowSec: 15 * 60 },
};

const isConflict = (err) => /HTTP 409/.test(String(err?.message));

/** customers row → what the customer may see (never the hash). */
export function publicCustomer(row) {
  if (!row) return null;
  const out = {};
  for (const k of CUSTOMER_PUBLIC_COLUMNS) if (k in row) out[k] = row[k];
  return out;
}

export function createHandler({ env, db, attemptStore, now = () => Date.now(), log = console, hash = bcrypt }) {
  const sessions = createSessionResolver({ db, now });
  const iso = () => new Date(now()).toISOString();

  function limiter() {
    return createRateLimiter({ store: attemptStore, pepper: env.AUTH_PEPPER, now });
  }

  async function startSession(event, customerId) {
    const token = newSessionToken();
    const at = iso();
    await db.createSession({
      customer_id: customerId,
      token_hash: hashToken(token),
      expires_at: new Date(now() + SESSION_MAX_AGE * 1000).toISOString(),
      last_seen_at: at,
      user_agent: String(header(event, "user-agent") || "").slice(0, 200) || null,
    });
    return sessionCookie(token);
  }

  /* ---------------- signup ---------------- */
  async function signup(body, event) {
    const phone = normaliseNgPhone(body.phone);
    if (!phone) return reply(400, { ok: false, error: "invalid_phone" });
    const pwErr = checkPassword(body.password);
    if (pwErr) return reply(400, { ok: false, error: pwErr });
    const name = checkName(body.name);
    if (!name.ok) return reply(400, { ok: false, error: name.error });
    const email = checkEmail(body.email);
    if (!email.ok) return reply(400, { ok: false, error: email.error });

    const rules = [
      { ...LIMITS.signupPhone, subject: `phone:${phone}` },
      { ...LIMITS.signupIp, subject: `ip:${clientIp(event)}` },
    ];
    const rl = limiter();
    const gate = await rl.check(rules);
    if (gate.blocked) return tooManyRequests(gate.retryAfter, { "Cache-Control": "no-store" });
    await rl.record(rules, { success: true });

    const spellings = phoneSpellings(phone);
    const rows = await db.findCustomersByPhone(spellings);
    const creds = await db.getCredentials(rows.map((r) => r.id));
    if (creds.length || rows.some((r) => r.password_hash)) return reply(409, { ok: false, error: "account_exists" });

    const passwordHash = await hash.hash(body.password, BCRYPT_COST);
    const claimedAt = iso();

    // Reuse the guest row (checkout) for this phone, else create one.
    let customer = rows[0] || null;
    if (customer) {
      const patch = { name: name.value };
      if (email.value) patch.email = email.value;
      if (customer.phone !== phone && !rows.some((r) => r.phone === phone)) patch.phone = phone;
      customer = (await db.updateCustomer(customer.id, patch)) || customer;
    } else {
      try {
        customer = await db.insertCustomer({ phone, name: name.value, email: email.value });
      } catch (err) {
        if (!isConflict(err)) throw err;
        customer = (await db.findCustomersByPhone(spellings))[0] || null;   // double submit
        if (!customer) throw err;
      }
    }

    try {
      await db.insertCredential({ customer_id: customer.id, password_hash: passwordHash, claimed_at: claimedAt, updated_at: claimedAt });
    } catch (err) {
      if (isConflict(err)) return reply(409, { ok: false, error: "account_exists" });
      throw err;
    }

    const cookie = await startSession(event, customer.id);
    const earlier = await db.countEarlierOrders({ customerId: customer.id, claimedAt }, spellings);
    return reply(200, { ok: true, customer: publicCustomer(customer), earlierGuestOrders: earlier > 0 }, { cookies: [cookie] });
  }

  /* ---------------- signin ---------------- */
  async function signin(body, event) {
    const phone = normaliseNgPhone(body.phone);
    if (!phone) return reply(400, { ok: false, error: "invalid_phone" });
    if (typeof body.password !== "string" || !body.password) return reply(400, { ok: false, error: "password_required" });

    const rules = [
      { ...LIMITS.signinPhone, subject: `phone:${phone}` },
      { ...LIMITS.signinIp, subject: `ip:${clientIp(event)}` },
    ];
    const rl = limiter();
    const gate = await rl.check(rules);
    if (gate.blocked) return tooManyRequests(gate.retryAfter, { "Cache-Control": "no-store" });

    const rows = await db.findCustomersByPhone(phoneSpellings(phone));
    const creds = await db.getCredentials(rows.map((r) => r.id));
    const cred = creds[0] || null;
    const customer = (cred && rows.find((r) => r.id === cred.customer_id)) || rows.find((r) => r.password_hash) || null;
    const stored = cred?.password_hash || customer?.password_hash || null;

    let ok = false;
    try {
      ok = await hash.compare(body.password, stored || DUMMY_HASH);
    } catch { ok = false; }
    if (!stored || !ok || !customer) {
      await rl.recordFailure(rules);
      return reply(401, { ok: false, error: "invalid_credentials" });
    }

    if (!cred) {
      // Hash only in customers.password_hash: copy it across (claimed now).
      try {
        await db.insertCredential({ customer_id: customer.id, password_hash: stored, claimed_at: iso(), updated_at: iso() });
      } catch (err) {
        if (!isConflict(err)) throw err;
      }
    }

    const cookie = await startSession(event, customer.id);
    return reply(200, { ok: true, customer: publicCustomer(customer) }, { cookies: [cookie] });
  }

  /* ---------------- signout ---------------- */
  async function signout(_body, event) {
    const token = cookieToken(event);
    if (token) {
      const row = await db.getSessionByHash(hashToken(token));
      if (row?.id) await db.deleteSession(row.id);
    }
    // LEGACY (delete after Step B): also end an old header session.
    const legacy = header(event, "x-customer-session");
    if (legacy && /^[A-Za-z0-9_-]{16,128}$/.test(legacy)) await db.deleteLegacySession(legacy);
    return reply(200, { ok: true }, { cookies: [clearSessionCookie()] });
  }

  /* ---------------- signed-in actions ---------------- */
  async function me(_body, _event, session) {
    return reply(200, { ok: true, customer: publicCustomer(session.customer), via: session.via });
  }

  async function changePassword(body, _event, session) {
    const customerId = session.customer.id;
    const pwErr = checkPassword(body.newPassword);
    if (pwErr) return reply(400, { ok: false, error: pwErr });

    const rules = [{ ...LIMITS.changePassword, subject: `customer:${customerId}` }];
    const rl = limiter();
    const gate = await rl.check(rules);
    if (gate.blocked) return tooManyRequests(gate.retryAfter, { "Cache-Control": "no-store" });

    const cred = await db.getCredential(customerId);
    const stored = cred?.password_hash || session.customer.password_hash || null;
    let ok = false;
    try {
      ok = typeof body.currentPassword === "string" && body.currentPassword !== "" &&
        await hash.compare(body.currentPassword, stored || DUMMY_HASH);
    } catch { ok = false; }
    if (!stored || !ok) {
      await rl.recordFailure(rules);
      return reply(400, { ok: false, error: "wrong_current_password" });
    }
    if (body.newPassword === body.currentPassword) return reply(400, { ok: false, error: "same_password" });

    const newHash = await hash.hash(body.newPassword, BCRYPT_COST);
    if (cred) await db.updateCredentialHash(customerId, newHash, iso());
    else await db.insertCredential({ customer_id: customerId, password_hash: newHash, claimed_at: iso(), updated_at: iso() });

    const revoked = await db.deleteOtherSessions(customerId, session.sessionId);
    return reply(200, { ok: true, revokedOtherSessions: revoked });
  }

  async function updateProfile(body, _event, session) {
    const input = {};
    for (const k of ["name", "email", "gender", "dob", "marketing_opt_in"]) if (k in body) input[k] = body[k];
    const checked = checkProfilePatch(input, new Date(now()));
    if (!checked.ok) return reply(400, { ok: false, error: checked.error });
    const row = await db.updateCustomer(session.customer.id, checked.patch);
    return reply(200, { ok: true, customer: publicCustomer(row || { ...session.customer, ...checked.patch }) });
  }

  const PUBLIC = { signup, signin, signout };
  const SIGNED_IN = { me, "change-password": changePassword, "update-profile": updateProfile };

  return async function handler(event) {
    let body;
    if (event.httpMethod === "GET") {
      body = { action: "me" };           // read-only; no Origin needed
    } else {
      const parsed = readJsonPost(event, env, MAX_BODY);
      if (parsed.error) return parsed.error;
      body = parsed.body;
    }
    const action = typeof body.action === "string" ? body.action : "";

    try {
      if (Object.hasOwn(PUBLIC, action)) return await PUBLIC[action](body, event);
      if (Object.hasOwn(SIGNED_IN, action)) {
        const session = await sessions.resolve(event);
        if (!session) {
          // A dead cookie is cleared so the browser stops sending it.
          return reply(401, { ok: false, error: "unauthorized" }, { cookies: cookieToken(event) ? [clearSessionCookie()] : [] });
        }
        return await SIGNED_IN[action](body, event, session);
      }
      return reply(400, { ok: false, error: "unknown_action" });
    } catch (err) {
      if (err instanceof RateLimitConfigError) {
        log.error("[customer-auth] AUTH_PEPPER is not set: refusing (fail closed). Set it in Netlify env.");
        return reply(500, { ok: false, error: "not_configured" });
      }
      log.error("[customer-auth] error:", err?.message || err);
      return reply(500, { ok: false, error: "server_error" });
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Netlify entry point                                                */
/* ------------------------------------------------------------------ */

export const handler = async (event) => {
  if (!serviceDbConfigured(process.env)) {
    console.error("[customer-auth] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    return reply(500, { ok: false, error: "not_configured" });
  }
  const rest = createRest(process.env);
  return createHandler({ env: process.env, db: restDb(rest), attemptStore: restAttemptStore(rest) })(event);
};
