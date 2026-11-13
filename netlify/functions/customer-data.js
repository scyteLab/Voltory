/**
 * customer-data  —  Netlify function (SERVICE ROLE)
 *
 * Phase 1 of docs/CUSTOMER_AUTH_LOCKDOWN_PLAN.md: every storefront
 * read of orders / order_items goes through here, so the anon key can
 * lose SELECT on those tables (Step A).
 *
 * Request:  POST /.netlify/functions/customer-data
 *           Content-Type: application/json, same-origin only
 *           X-Customer-Session: <localStorage session token>  (optional;
 *             Phase 1 only — Phase 2 replaces it with an HttpOnly cookie)
 *
 *   { action: "orders" }
 *       Signed-in customer's orders + items, newest first. Matches
 *       customer_id OR customer_phone (both spellings). 401 without a
 *       valid session.
 *   { action: "order", id, phone }
 *       One order + items, when id AND phone match, or the session
 *       owns the order. Rate-limited.
 *   { action: "track", id, phone }
 *       Same check, tracking fields only (no name, street, email).
 *
 * Responses: 200 { ok:true, orders } | { ok:true, order }
 *            400 bad input · 401 no session · 403 bad origin
 *            404 { error:"not_found" } (unknown id and wrong phone look
 *                the same) · 405 · 413 · 415 · 429 + Retry-After · 500
 *
 * Rate limits (failed lookups only, per 10 minutes):
 *   5 per order id, 10 per IP. See _shared/rateLimit.js.
 */
import { normaliseNgPhone, samePhone } from "../../src/utils/phone.js";
import { toStorefrontShape, toTrackingShape } from "../../src/lib/orderShape.js";
import { createRest, enc, serviceDbConfigured } from "./_shared/serviceDb.js";
import {
  RateLimitConfigError, clientIp, createRateLimiter, restAttemptStore, tooManyRequests,
} from "./_shared/rateLimit.js";

const MAX_BODY = 4 * 1024;
const LOOKUP_WINDOW_SEC = 10 * 60;
const LIMIT_PER_ORDER = 5;
const LIMIT_PER_IP = 10;

const ORDER_ID_RE = /^[A-Z0-9][A-Z0-9-]{5,39}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const baseHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const reply = (statusCode, body) => ({ statusCode, headers: baseHeaders, body: JSON.stringify(body) });

const header = (event, name) => {
  const h = event?.headers || {};
  const key = Object.keys(h).find((k) => k.toLowerCase() === name);
  return key ? h[key] : undefined;
};

/** "0803…" and "+234803…" for a valid number; [] otherwise. */
export function phoneSpellings(raw) {
  const local = normaliseNgPhone(raw);
  return local ? [local, "+234" + local.slice(1)] : [];
}

export const normalizeOrderId = (id) => String(id ?? "").trim().toUpperCase();

/** Origins allowed to call this function (same-site only). */
export function allowedOrigins(env) {
  const out = new Set(["https://mynaven.com", "https://www.mynaven.com"]);
  const extra = String(env.ALLOWED_ORIGINS || "").split(",");
  for (const v of [env.URL, env.DEPLOY_PRIME_URL, env.DEPLOY_URL, env.SITE_URL, ...extra]) {
    if (!v || !v.trim()) continue;
    try {
      const u = new URL(v.trim());
      out.add(u.origin);
      const port = u.port ? `:${u.port}` : "";
      const twin = u.hostname.startsWith("www.") ? u.hostname.slice(4) : `www.${u.hostname}`;
      out.add(`${u.protocol}//${twin}${port}`);
    } catch { /* ignore malformed */ }
  }
  return out;
}

export function originAllowed(origin, env) {
  if (!origin) return false;
  if (env.NETLIFY_DEV === "true" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return allowedOrigins(env).has(origin);
}

/* ------------------------------------------------------------------ */
/*  Data access (service role). Injected so tests can use a fake.     */
/* ------------------------------------------------------------------ */

export function restDb(rest) {
  return {
    async getSession(token) {
      const r = await rest(
        "GET",
        `customer_sessions?select=customer_id,expires_at,revoked_at&token=eq.${enc(token)}&limit=1`,
      );
      return r.data?.[0] || null;
    },
    async getCustomer(id) {
      const r = await rest("GET", `customers?select=id,phone&id=eq.${enc(id)}&limit=1`);
      return r.data?.[0] || null;
    },
    async getOrder(id) {
      const r = await rest("GET", `orders?select=*,order_items(*)&id=eq.${enc(id)}&limit=1`);
      return r.data?.[0] || null;
    },
    async listOrdersForCustomer(customerId, phones) {
      const parts = [`customer_id.eq.${customerId}`];
      if (phones.length) parts.push(`customer_phone.in.(${phones.map((p) => `"${p}"`).join(",")})`);
      const r = await rest(
        "GET",
        `orders?select=*,order_items(*)&or=${enc(`(${parts.join(",")})`)}&order=created_at.desc`,
      );
      return r.data || [];
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Handler factory                                                    */
/* ------------------------------------------------------------------ */

export function createHandler({ env, db, attemptStore, now = () => Date.now(), log = console }) {
  async function resolveSession(token) {
    if (!token || !TOKEN_RE.test(token)) return null;
    const s = await db.getSession(token);
    if (!s || s.revoked_at || !s.expires_at || new Date(s.expires_at).getTime() <= now()) return null;
    if (!UUID_RE.test(String(s.customer_id || ""))) return null;
    const customer = await db.getCustomer(s.customer_id);
    return customer ? { customer } : null;
  }

  async function lookup(body, event, session, mode) {
    const id = normalizeOrderId(body.id);
    if (!ORDER_ID_RE.test(id)) return reply(400, { ok: false, error: "invalid_id" });

    const phoneGiven = typeof body.phone === "string" && body.phone.trim() !== "";
    const phone = phoneGiven ? normaliseNgPhone(body.phone) : null;
    if (!phoneGiven && !session) return reply(400, { ok: false, error: "phone_required" });

    let limiter;
    try {
      limiter = createRateLimiter({ store: attemptStore, pepper: env.AUTH_PEPPER, now });
    } catch (err) {
      if (err instanceof RateLimitConfigError) {
        log.error("[customer-data] AUTH_PEPPER is not set: refusing order lookups (fail closed). Set it in Netlify env.");
        return reply(500, { ok: false, error: "not_configured" });
      }
      throw err;
    }

    const rules = [
      { kind: "order_lookup", subject: `ip:${clientIp(event)}`, limit: LIMIT_PER_IP, windowSec: LOOKUP_WINDOW_SEC },
      { kind: "order_lookup", subject: `order:${id}`, limit: LIMIT_PER_ORDER, windowSec: LOOKUP_WINDOW_SEC },
    ];
    const gate = await limiter.check(rules);
    if (gate.blocked) return tooManyRequests(gate.retryAfter, { "Cache-Control": "no-store" });

    const row = await db.getOrder(id);
    const phoneMatches = Boolean(row && phone && normaliseNgPhone(row.customer_phone) === phone);
    const sessionOwns = Boolean(
      row && session &&
      ((row.customer_id && row.customer_id === session.customer.id) ||
       samePhone(row.customer_phone, session.customer.phone)),
    );

    if (!phoneMatches && !sessionOwns) {
      await limiter.recordFailure(rules);
      return reply(404, { ok: false, error: "not_found" });
    }

    if (mode === "track") {
      const shownPhone = phone || normaliseNgPhone(session?.customer?.phone) || "";
      return reply(200, { ok: true, order: toTrackingShape(row, shownPhone) });
    }
    return reply(200, { ok: true, order: toStorefrontShape(row) });
  }

  return async function handler(event) {
    if (event.httpMethod !== "POST") return reply(405, { ok: false, error: "method_not_allowed" });
    if (!originAllowed(header(event, "origin"), env)) return reply(403, { ok: false, error: "forbidden_origin" });
    if (!/^application\/json\b/i.test(header(event, "content-type") || "")) {
      return reply(415, { ok: false, error: "json_required" });
    }
    if ((event.body || "").length > MAX_BODY) return reply(413, { ok: false, error: "too_large" });

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return reply(400, { ok: false, error: "invalid_json" });
    }
    if (!body || typeof body !== "object") return reply(400, { ok: false, error: "invalid_json" });

    try {
      const session = await resolveSession(header(event, "x-customer-session"));

      switch (body.action) {
        case "orders": {
          if (!session) return reply(401, { ok: false, error: "unauthorized" });
          const rows = await db.listOrdersForCustomer(session.customer.id, phoneSpellings(session.customer.phone));
          return reply(200, { ok: true, orders: rows.map(toStorefrontShape).filter(Boolean) });
        }
        case "order":
        case "track":
          return await lookup(body, event, session, body.action);
        default:
          return reply(400, { ok: false, error: "unknown_action" });
      }
    } catch (err) {
      log.error("[customer-data] error:", err?.message || err);
      return reply(500, { ok: false, error: "server_error" });
    }
  };
}

/* ------------------------------------------------------------------ */
/*  Netlify entry point                                                */
/* ------------------------------------------------------------------ */

export const handler = async (event) => {
  if (!serviceDbConfigured(process.env)) {
    console.error("[customer-data] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
    return reply(500, { ok: false, error: "not_configured" });
  }
  const rest = createRest(process.env);
  return createHandler({
    env: process.env,
    db: restDb(rest),
    attemptStore: restAttemptStore(rest),
  })(event);
};
