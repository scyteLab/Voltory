/**
 * Minimal PostgREST client using the SERVICE ROLE key (bypasses RLS).
 * Server-side only: never import this from src/.
 */

export function serviceDbConfigured(env = process.env) {
  return Boolean((env.SUPABASE_URL || env.VITE_SUPABASE_URL) && env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * rest(method, path, { body, prefer }) → { status, data, contentRange }
 * Throws on HTTP errors, with the PostgREST message (never the key).
 */
export function createRest(env = process.env, fetchImpl = fetch) {
  const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  return async function rest(method, path, { body, prefer } = {}) {
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    const res = await fetchImpl(`${base}/rest/v1/${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) {
      throw new Error(`Supabase ${method} ${path.split("?")[0]} failed: HTTP ${res.status} ${data?.message || ""}`.trim());
    }
    return { status: res.status, data, contentRange: res.headers.get("content-range") };
  };
}

/** "0-0/5" or "*\/0" → 5 / 0 */
export function countFromContentRange(cr) {
  const total = String(cr || "").split("/")[1];
  const n = Number(total);
  return Number.isFinite(n) ? n : 0;
}

export const enc = (v) => encodeURIComponent(String(v));
