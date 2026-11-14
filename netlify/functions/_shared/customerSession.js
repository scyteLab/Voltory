/**
 * THE customer session helper (Phase 2 of
 * docs/CUSTOMER_AUTH_LOCKDOWN_PLAN.md). customer-auth and customer-data
 * both turn a request into a signed-in customer ONLY through
 * createSessionResolver().resolve(event).
 *
 * Sessions (server-made):
 *   · token = 32 random bytes, base64url, sent only in the HttpOnly
 *     cookie `naven_session`; the database stores sha256(token) in
 *     customer_sessions.token_hash, never the token
 *   · fixed 30-day expiry; last_seen_at refreshed at most once an hour
 *   · sign-out deletes the row; a password change deletes all others
 *
 * Order of checks:
 *   (a) cookie naven_session → token_hash lookup
 *   (b) TEMPORARY (delete after STEP B): the old X-Customer-Session
 *       header against customer_sessions.token (browser-minted rows).
 *       Step B deletes every such row, after which (b) can't match;
 *       remove LEGACY_HEADER_FALLBACK and everything marked "LEGACY".
 *       Legacy sessions are never upgraded to cookies: a row the
 *       browser could forge must not outlive Step B.
 *
 * resolve() → { customer, sessionId, owner: { customerId, claimedAt }, via }
 *           | null
 */
import { createHash, randomBytes } from "node:crypto";

export const COOKIE_NAME = "naven_session";
export const SESSION_DAYS = 30;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;   // 2592000
const TOUCH_EVERY_MS = 60 * 60 * 1000;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;                        // 32 bytes, base64url
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// LEGACY (delete after Step B): browser-minted tokens were crypto.randomUUID().
export const LEGACY_HEADER_FALLBACK = true;
const LEGACY_TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export const newSessionToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");

export function header(event, name) {
  const h = event?.headers || {};
  const key = Object.keys(h).find((k) => k.toLowerCase() === name);
  return key ? h[key] : undefined;
}

/** "a=1; naven_session=xyz" → { a: "1", naven_session: "xyz" } (first value wins). */
export function parseCookies(raw) {
  const out = {};
  for (const part of String(raw || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    if (!(k in out)) out[k] = part.slice(i + 1).trim();
  }
  return out;
}

/** HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30 days; no Domain (exact host only). */
export const sessionCookie = (token) =>
  `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
export const clearSessionCookie = () =>
  `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

export function cookieToken(event) {
  const t = parseCookies(header(event, "cookie"))[COOKIE_NAME];
  return t && TOKEN_RE.test(t) ? t : null;
}

/**
 * When this customer's phone was claimed by an account (see
 * _shared/orderOwnership.js):
 *   · customer_credentials.claimed_at (sign-up time, or created_at for
 *     accounts migrated by STEP B-0)
 *   · LEGACY: no credentials row yet, hash only in customers.password_hash
 *     (written by the old browser code after B-0 ran) → claimedAt null
 *     until their first server sign-in copies it (claimed then).
 */
export function claimedAtFor(cred) {
  return cred?.claimed_at || null;
}

const expired = (row, now) => !row?.expires_at || new Date(row.expires_at).getTime() <= now;

/**
 * db: getSessionByHash(hash), getLegacySession(token), getCustomer(id),
 *     getCredential(customerId), touchSession(id, iso)
 */
export function createSessionResolver({ db, now = () => Date.now() }) {
  async function finish(row, via) {
    if (!row || row.revoked_at || expired(row, now())) return null;
    if (!UUID_RE.test(String(row.customer_id || ""))) return null;
    const [customer, cred] = await Promise.all([db.getCustomer(row.customer_id), db.getCredential(row.customer_id)]);
    if (!customer) return null;
    if (via === "cookie" && row.id) {
      const seen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : 0;
      if (now() - seen >= TOUCH_EVERY_MS) {
        await db.touchSession(row.id, new Date(now()).toISOString()).catch(() => {});
      }
    }
    return {
      customer,
      sessionId: row.id || null,
      owner: { customerId: customer.id, claimedAt: claimedAtFor(cred) },
      hasPassword: Boolean(cred?.password_hash || customer.password_hash),
      via,
    };
  }

  async function resolve(event) {
    const token = cookieToken(event);
    if (token) {
      const s = await finish(await db.getSessionByHash(hashToken(token)), "cookie");
      if (s) return s;
    }
    // LEGACY (delete after Step B): old browser-minted session in the X-Customer-Session header.
    if (LEGACY_HEADER_FALLBACK) {
      const legacy = header(event, "x-customer-session");
      if (legacy && LEGACY_TOKEN_RE.test(legacy)) {
        return finish(await db.getLegacySession(legacy), "legacy-header");
      }
    }
    return null;
  }

  return { resolve };
}
