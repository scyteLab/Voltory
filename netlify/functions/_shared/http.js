/**
 * Request/response helpers shared by customer-auth and customer-data.
 *
 * CSRF guard (with the SameSite=Lax session cookie): every request that
 * changes something must be POST + Content-Type: application/json +
 * an Origin from allowedOrigins().
 */
import { normaliseNgPhone } from "../../../src/utils/phone.js";
import { header } from "./customerSession.js";

export { header };

const baseHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

/** JSON reply; `cookies` → Set-Cookie (one header, or multiValueHeaders for several). */
export function reply(statusCode, body, { cookies = [], headers = {} } = {}) {
  const res = { statusCode, headers: { ...baseHeaders, ...headers }, body: JSON.stringify(body) };
  if (cookies.length === 1) res.headers["Set-Cookie"] = cookies[0];
  else if (cookies.length > 1) res.multiValueHeaders = { "Set-Cookie": cookies };
  return res;
}

/** "0803…" and "+234803…" for a valid number; [] otherwise. */
export function phoneSpellings(raw) {
  const local = normaliseNgPhone(raw);
  return local ? [local, "+234" + local.slice(1)] : [];
}

/** Origins allowed to call the customer functions (same-site only). */
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

/**
 * POST + JSON + allowed Origin + size limit + parse. Returns
 * { body } or { error: <reply> }.
 */
export function readJsonPost(event, env, maxBytes) {
  if (event.httpMethod !== "POST") return { error: reply(405, { ok: false, error: "method_not_allowed" }) };
  if (!originAllowed(header(event, "origin"), env)) return { error: reply(403, { ok: false, error: "forbidden_origin" }) };
  if (!/^application\/json\b/i.test(header(event, "content-type") || "")) {
    return { error: reply(415, { ok: false, error: "json_required" }) };
  }
  if ((event.body || "").length > maxBytes) return { error: reply(413, { ok: false, error: "too_large" }) };
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { error: reply(400, { ok: false, error: "invalid_json" }) };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: reply(400, { ok: false, error: "invalid_json" }) };
  return { body };
}
