/**
 * admin-team  —  Netlify serverless function (GM only)
 *
 * Backs the admin Team page. Creating sign-in accounts, banning them
 * and writing admin_roles all need the service role key, so the
 * browser can't do them; it sends its Supabase access token and this
 * function checks the caller is an ACTIVE GM before doing anything.
 *
 * Request:  POST, header Authorization: Bearer <supabase access token>
 *   { action: "list" }
 *   { action: "create", email, role, password }   — new account (or an
 *        existing sign-in account with no role) gets the role
 *   { action: "set_role", userId, role }
 *   { action: "deactivate", userId }              — blocks sign-in, keeps the row
 *   { action: "reactivate", userId }
 *   { action: "remove", userId }                  — deletes the role row, blocks sign-in
 *
 * Guard rails: a GM can't demote, deactivate or remove themselves,
 * so there is always at least one active GM.
 *
 * Env vars: SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY.
 * Needs supabase/admin_roles_update.sql (store / support roles,
 * deactivated_at column).
 */
import { isValidEmail, supabaseConfigured } from "./_shared/email.js";

const ROLES = new Set(["gm", "store", "support"]);
const BAN_FOREVER = "876000h"; // ~100 years
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const headers = { "Content-Type": "application/json" };
const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const base = () => (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL).replace(/\/$/, "");
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY;

async function call(path, { method = "GET", body, bearer, prefer } = {}) {
  const res = await fetch(`${base()}${path}`, {
    method,
    headers: {
      apikey: key(),
      Authorization: `Bearer ${bearer || key()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.msg || json?.message || json?.error_description || json?.error || `HTTP ${res.status}`;
    throw new HttpError(res.status, msg);
  }
  return json;
}

const rest = (path, opts) => call(`/rest/v1/${path}`, opts);

async function roleRow(userId) {
  const rows = await rest(`admin_roles?user_id=eq.${userId}&select=user_id,role,deactivated_at`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

/** The caller, if their token is valid and they are an active GM. */
async function requireGM(event) {
  const auth = event.headers?.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new HttpError(401, "Not signed in.");
  let user;
  try {
    user = await call("/auth/v1/user", { bearer: token });
  } catch {
    throw new HttpError(401, "Session expired. Sign in again.");
  }
  const row = await roleRow(user.id);
  if (!row || row.role !== "gm" || row.deactivated_at) throw new HttpError(403, "Only the GM can manage the team.");
  return user;
}

async function listAuthUsers() {
  const users = [];
  for (let page = 1; page <= 20; page += 1) {
    const data = await call(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const batch = data?.users || [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

async function list() {
  const [roles, users] = await Promise.all([
    rest("admin_roles?select=user_id,role,totp_enrolled_at,deactivated_at,created_at&order=created_at.asc"),
    listAuthUsers(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  return roles.map((r) => {
    const u = byId.get(r.user_id);
    return {
      user_id: r.user_id,
      email: u?.email || "(account deleted)",
      role: r.role,
      totp_enrolled: Boolean(r.totp_enrolled_at),
      deactivated_at: r.deactivated_at,
      last_sign_in_at: u?.last_sign_in_at || null,
      created_at: r.created_at,
    };
  });
}

const upsertRole = (userId, role) => rest("admin_roles?on_conflict=user_id", {
  method: "POST",
  prefer: "resolution=merge-duplicates,return=minimal",
  body: { user_id: userId, role, deactivated_at: null },
});

const setBan = (userId, banned) => call(`/auth/v1/admin/users/${userId}`, {
  method: "PUT", body: { ban_duration: banned ? BAN_FOREVER : "none" },
});

async function create({ email, role, password }) {
  const cleaned = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!isValidEmail(cleaned)) throw new HttpError(400, "Enter a valid email.");
  if (!ROLES.has(role)) throw new HttpError(400, "Choose a role.");
  if (typeof password !== "string" || password.length < 10) {
    throw new HttpError(400, "The temporary password needs at least 10 characters.");
  }

  const existing = (await listAuthUsers()).find((u) => (u.email || "").toLowerCase() === cleaned);
  let userId;
  if (existing) {
    const row = await roleRow(existing.id);
    if (row) throw new HttpError(409, `${cleaned} is already on the team (${row.role}). Change their role instead.`);
    // Existing sign-in account without a role: give it the role and
    // the new temporary password, and make sure it isn't banned.
    await call(`/auth/v1/admin/users/${existing.id}`, {
      method: "PUT", body: { password, ban_duration: "none", email_confirm: true },
    });
    userId = existing.id;
  } else {
    const created = await call("/auth/v1/admin/users", {
      method: "POST", body: { email: cleaned, password, email_confirm: true },
    });
    userId = created.id;
  }
  await upsertRole(userId, role);
  return { userId, existed: Boolean(existing) };
}

function targetId(userId, gm, { notSelf }) {
  if (typeof userId !== "string" || !UUID_RE.test(userId)) throw new HttpError(400, "Invalid user.");
  if (notSelf && userId === gm.id) throw new HttpError(400, "You can't do that to your own account.");
  return userId;
}

async function requireRow(userId) {
  const row = await roleRow(userId);
  if (!row) throw new HttpError(404, "That person isn't on the team.");
  return row;
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return reply(405, { ok: false, error: "Method not allowed" });
  if (!supabaseConfigured()) {
    console.error("[admin-team] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    return reply(500, { ok: false, error: "Server not configured (Supabase service key missing)." });
  }
  if ((event.body || "").length > 4096) return reply(400, { ok: false, error: "Body too large" });

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { ok: false, error: "Invalid JSON body" });
  }

  try {
    const gm = await requireGM(event);
    const { action } = payload;

    if (action === "list") return reply(200, { ok: true, rows: await list() });

    if (action === "create") {
      const res = await create(payload);
      console.log("[admin-team] create", { by: gm.email, role: payload.role, ...res });
      return reply(200, { ok: true, ...res });
    }

    if (action === "set_role") {
      const userId = targetId(payload.userId, gm, { notSelf: true });
      if (!ROLES.has(payload.role)) throw new HttpError(400, "Choose a role.");
      await requireRow(userId);
      await rest(`admin_roles?user_id=eq.${userId}`, {
        method: "PATCH", prefer: "return=minimal", body: { role: payload.role },
      });
      console.log("[admin-team] set_role", { by: gm.email, userId, role: payload.role });
      return reply(200, { ok: true });
    }

    if (action === "deactivate" || action === "reactivate") {
      const userId = targetId(payload.userId, gm, { notSelf: true });
      await requireRow(userId);
      const off = action === "deactivate";
      await setBan(userId, off);
      await rest(`admin_roles?user_id=eq.${userId}`, {
        method: "PATCH", prefer: "return=minimal",
        body: { deactivated_at: off ? new Date().toISOString() : null },
      });
      console.log(`[admin-team] ${action}`, { by: gm.email, userId });
      return reply(200, { ok: true });
    }

    if (action === "remove") {
      const userId = targetId(payload.userId, gm, { notSelf: true });
      await requireRow(userId);
      await setBan(userId, true);
      await rest(`admin_roles?user_id=eq.${userId}`, { method: "DELETE", prefer: "return=minimal" });
      console.log("[admin-team] remove", { by: gm.email, userId });
      return reply(200, { ok: true });
    }

    return reply(400, { ok: false, error: "Unknown action." });
  } catch (err) {
    const status = err instanceof HttpError && err.status < 500 ? err.status : 502;
    if (status >= 500) console.error("[admin-team] failed:", err.message);
    return reply(status, { ok: false, error: err.message || "Request failed." });
  }
};
