/**
 * Server-side rate limiting backed by public.auth_attempts
 * (service role only; see supabase/customer_lockdown.sql, Step 0).
 *
 * Rows hold an HMAC of the subject ("ip:1.2.3.4", "order:VLT-…",
 * "phone:0803…"), keyed with AUTH_PEPPER, never the raw value (NDPA).
 * Lookups: only FAILED attempts count toward a limit, so a customer
 * reopening their own order or receipt never locks themselves out,
 * while guessing IDs/phones does. Writes (reviews): rules with
 * countAll: true count EVERY attempt, recorded with record(). Rows older than 24 h are deleted on every
 * check.
 *
 * AUTH_PEPPER missing → createRateLimiter throws RateLimitConfigError
 * and the caller must refuse the request (fail closed).
 */
import { createHmac } from "node:crypto";
import { countFromContentRange, enc } from "./serviceDb.js";

export class RateLimitConfigError extends Error {}

const KEEP_MS = 24 * 60 * 60 * 1000;

/** Client IP as Netlify reports it (not spoofable by the client). */
export function clientIp(event) {
  const h = event?.headers || {};
  return h["x-nf-client-connection-ip"] || h["X-Nf-Client-Connection-Ip"] || "unknown";
}

/** PostgREST storage for auth_attempts. */
export function restAttemptStore(rest) {
  return {
    async countFailures(kind, keyHash, sinceIso, { includeSuccess = false } = {}) {
      const r = await rest(
        "GET",
        `auth_attempts?select=created_at&kind=eq.${enc(kind)}&key_hash=eq.${enc(keyHash)}` +
          `${includeSuccess ? "" : "&success=is.false"}&created_at=gt.${enc(sinceIso)}&order=created_at.asc&limit=1`,
        { prefer: "count=exact" },
      );
      return { count: countFromContentRange(r.contentRange), oldest: r.data?.[0]?.created_at || null };
    },
    async insert(rows) {
      await rest("POST", "auth_attempts", { body: rows, prefer: "return=minimal" });
    },
    async purgeBefore(iso) {
      await rest("DELETE", `auth_attempts?created_at=lt.${enc(iso)}`, { prefer: "return=minimal" });
    },
  };
}

/**
 * rules: [{ kind, subject, limit, windowSec, countAll? }]
 *   check(rules)                 → { blocked, retryAfter (seconds) }
 *   recordFailure(rules)         → logs one failed attempt per rule
 *   record(rules, { success })   → logs one attempt per rule
 */
export function createRateLimiter({ store, pepper, now = () => Date.now() }) {
  if (!pepper) throw new RateLimitConfigError("AUTH_PEPPER is not set");
  const hash = (kind, subject) => createHmac("sha256", pepper).update(`${kind}|${subject}`).digest("hex");
  const record = (rules, { success = false } = {}) =>
    store.insert(rules.map((r) => ({ kind: r.kind, key_hash: hash(r.kind, r.subject), success: Boolean(success) })));

  return {
    async check(rules) {
      const t = now();
      // Housekeeping; never blocks the decision.
      await store.purgeBefore(new Date(t - KEEP_MS).toISOString()).catch(() => {});
      let retryAfter = 0;
      for (const r of rules) {
        const since = new Date(t - r.windowSec * 1000).toISOString();
        const { count, oldest } = await store.countFailures(
          r.kind, hash(r.kind, r.subject), since, { includeSuccess: Boolean(r.countAll) },
        );
        if (count >= r.limit) {
          const frees = oldest ? new Date(oldest).getTime() + r.windowSec * 1000 : t + r.windowSec * 1000;
          retryAfter = Math.max(retryAfter, Math.ceil((frees - t) / 1000), 1);
        }
      }
      return { blocked: retryAfter > 0, retryAfter };
    },
    recordFailure: (rules) => record(rules, { success: false }),
    record,
  };
}

/** Standard 429 body + Retry-After header. */
export function tooManyRequests(retryAfter, extraHeaders = {}) {
  return {
    statusCode: 429,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": String(retryAfter), ...extraHeaders },
    body: JSON.stringify({ ok: false, error: "rate_limited", retryAfter }),
  };
}
