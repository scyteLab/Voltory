import { supabase } from "./supabaseClient.js";

/**
 * adminTeamClient  —  Team page (GM only)
 *
 * Everything goes through the admin-team Netlify function, which
 * holds the service role key (creating sign-in accounts and banning
 * them can't be done from the browser) and re-checks that the caller
 * is an active GM. See netlify/functions/admin-team.js.
 *
 * Every call resolves { ok, ...data } or { ok: false, error }.
 */
const ENDPOINT = "/.netlify/functions/admin-team";

async function teamCall(action, body = {}) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return { ok: false, error: "Not signed in." };
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      return { ok: false, error: json.error || `Request failed (HTTP ${res.status}).` };
    }
    return { ok: true, ...json };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/** rows: [{ user_id, email, role, totp_enrolled, deactivated_at, last_sign_in_at, created_at }] */
export const fetchAdminTeam = () => teamCall("list");

/** New staff account with a temporary password (or role for an existing account). */
export const addStaffMember = ({ email, role, password }) => teamCall("create", { email, role, password });

export const changeStaffRole = (userId, role) => teamCall("set_role", { userId, role });
export const deactivateStaff = (userId) => teamCall("deactivate", { userId });
export const reactivateStaff = (userId) => teamCall("reactivate", { userId });
export const removeStaff     = (userId) => teamCall("remove", { userId });

/* ============================================================
   Execute an approved role change
   ============================================================ */

/**
 * Called by the GM Portal after decideApproval marks the
 * approval as 'approved'. Applies the actual role change. (Role
 * changes are now made directly on the Team page; this still runs
 * any role-change approvals created before that.)
 * Idempotent \u2014 upsert on user_id.
 */
export async function executeRoleChange(payload) {
  if (!payload?.target_user_id || !payload?.new_role) {
    return { ok: false, error: "Invalid role change payload." };
  }

  try {
    const { error } = await supabase
      .from("admin_roles")
      .upsert(
        // 'staff' was retired for 'store' (supabase/admin_roles_update.sql).
        { user_id: payload.target_user_id, role: payload.new_role === "staff" ? "store" : payload.new_role },
        { onConflict: "user_id" }
      );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}