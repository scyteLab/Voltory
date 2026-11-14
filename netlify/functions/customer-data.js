/**
 * customer-data  —  Netlify function (SERVICE ROLE)
 *
 * Every storefront read/write of a customer's own data goes through
 * here (docs/CUSTOMER_AUTH_LOCKDOWN_PLAN.md, Phases 1–3), so the anon
 * key needs no access to orders, addresses or customers.
 *
 * Request:  POST /.netlify/functions/customer-data
 *           Content-Type: application/json, same-origin only
 *           Session: the HttpOnly cookie naven_session (set by
 *             customer-auth). LEGACY until Step B: X-Customer-Session.
 *
 *   { action: "orders" }
 *       Signed-in customer's orders + items, newest first, by THE
 *       ownership rule (_shared/orderOwnership.js): customer_id = me
 *       and placed on/after the account's claimed_at. Also returns
 *       earlierGuestOrders (true when older guest orders exist for
 *       this phone; they stay reachable through Track Order). 401
 *       without a valid session.
 *   { action: "order", id, phone }
 *       One order + items, when id AND phone match, or the session
 *       owns the order (same rule). Rate-limited.
 *   { action: "track", id, phone }
 *       Same check, tracking fields only (no name, street, email).
 *
 *   Addresses (signed-in; _shared/addressActions.js):
 *     address-list, address-create, address-update,
 *     address-set-default, address-delete
 *   Reviews (signed-in; _shared/reviewActions.js):
 *     review-eligibility, review-upsert, review-delete, my-reviews
 *   Product Q&A (signed-in; _shared/questionActions.js):
 *     question-ask, question-delete, my-questions
 *
 * Responses: 200 { ok:true, … } · 400 bad input · 401 no session ·
 *            403 bad origin · 404 { error:"not_found" } (unknown id and
 *            wrong phone look the same) · 405 · 413 · 415 · 429 +
 *            Retry-After · 500
 *
 * Rate limits: order lookups 5 per order id / 10 per IP per 10 min
 * (failed only); review writes 10 per customer per hour (all);
 * questions asked 5 per customer per hour (all).
 *
 * Sessions: _shared/customerSession.js is the ONE place a request
 * becomes a signed-in customer (shared with customer-auth).
 */
import { normaliseNgPhone } from "../../src/utils/phone.js";
import { toStorefrontShape, toTrackingShape } from "../../src/lib/orderShape.js";
import { createRest, serviceDbConfigured } from "./_shared/serviceDb.js";
import {
  RateLimitConfigError, clientIp, createRateLimiter, restAttemptStore, tooManyRequests,
} from "./_shared/rateLimit.js";
import { createReviewActions } from "./_shared/reviewActions.js";
import { createQuestionActions } from "./_shared/questionActions.js";
import { createAddressActions } from "./_shared/addressActions.js";
import { createSessionResolver } from "./_shared/customerSession.js";
import { ownsOrder } from "./_shared/orderOwnership.js";
import { restDb } from "./_shared/customerRestDb.js";
import { phoneSpellings, readJsonPost, reply } from "./_shared/http.js";

// Kept as named exports of this file (tests and older imports use them).
export { allowedOrigins, originAllowed, phoneSpellings } from "./_shared/http.js";
export { restDb } from "./_shared/customerRestDb.js";

const MAX_BODY = 8 * 1024;   // a 2000-character review plus JSON escaping
const LOOKUP_WINDOW_SEC = 10 * 60;
const LIMIT_PER_ORDER = 5;
const LIMIT_PER_IP = 10;

const ORDER_ID_RE = /^[A-Z0-9][A-Z0-9-]{5,39}$/;

export const normalizeOrderId = (id) => String(id ?? "").trim().toUpperCase();

/* ------------------------------------------------------------------ */
/*  Handler factory                                                    */
/* ------------------------------------------------------------------ */

export function createHandler({ env, db, attemptStore, now = () => Date.now(), log = console }) {
  const sessions = createSessionResolver({ db, now });

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
    // Guest lookup (ID + phone) is unchanged; the session path uses THE ownership rule.
    const phoneMatches = Boolean(row && phone && normaliseNgPhone(row.customer_phone) === phone);
    const sessionOwns = Boolean(session && ownsOrder(row, session.owner));

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

  async function myOrders(session) {
    const [rows, earlier] = await Promise.all([
      db.listOrdersForOwner(session.owner),
      db.countEarlierOrders(session.owner, phoneSpellings(session.customer.phone)),
    ]);
    return reply(200, { ok: true, orders: rows.map(toStorefrontShape).filter(Boolean), earlierGuestOrders: earlier > 0 });
  }

  const signedInActions = {
    orders: (_body, session) => myOrders(session),
    ...createAddressActions({ db, reply }),
    ...createReviewActions({ db, env, attemptStore, now, log, reply }),
    ...createQuestionActions({ db, env, attemptStore, now, log, reply }),
  };

  return async function handler(event) {
    const { body, error } = readJsonPost(event, env, MAX_BODY);
    if (error) return error;

    try {
      const session = await sessions.resolve(event);

      const signedInAction = typeof body.action === "string" && Object.hasOwn(signedInActions, body.action)
        ? signedInActions[body.action] : null;
      if (signedInAction) {
        if (!session) return reply(401, { ok: false, error: "unauthorized" });
        return await signedInAction(body, session);
      }

      switch (body.action) {
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
