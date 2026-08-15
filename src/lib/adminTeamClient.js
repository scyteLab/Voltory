import { supabase } from "./supabaseClient.js";
import { createApproval } from "./gmPortalClient.js";

/**
 * adminTeamClient  \u2014  admin roster + role-change proposals
 *
 * Uses two DB views (created in team_page_setup.sql):
 *   \u00B7 admin_directory  \u2014 admin_roles JOIN auth.users.email
 *   \u00B7 auth_users_public \u2014 id + email lookup for granting a
 *                         first role to an existing auth user
 *
 * Role changes never execute directly \u2014 they insert into
 * `approvals` and wait for a GM to decide. executeRoleChange
 * (below) is called only by the GM Portal AFTER a decision.
 */

/* ============================================================
   Fetch the team (people who already have a role)
   ============================================================ */

/**
 * List every admin with role + email. Returns { ok, rows }.
 * rows: [{ user_id, email, role, totp_enrolled_at, created_at }]
 */
export async function fetchAdminTeam() {
  try {
    const { data, error } = await supabase
      .from("admin_directory")
      .select("user_id, email, role, totp_enrolled_at, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[team] fetchAdminTeam failed:", error.message);
      return { ok: false, error: error.message, rows: [] };
    }
    return { ok: true, rows: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), rows: [] };
  }
}

/* ============================================================
   Look up a user by email (to grant them a first role)
   ============================================================ */

/**
 * Find an auth user by email. Used when adding an admin who
 * doesn't yet have an admin_roles row. Returns { ok, user }.
 * user: { user_id, email } | null (null if not found)
 */
export async function findAuthUserByEmail(email) {
  if (!email) return { ok: false, error: "Email required.", user: null };

  const cleaned = email.trim().toLowerCase();

  try {
    const { data, error } = await supabase
      .from("auth_users_public")
      .select("user_id, email")
      .eq("email", cleaned)
      .maybeSingle();

    if (error) {
      console.warn("[team] findAuthUserByEmail failed:", error.message);
      return { ok: false, error: error.message, user: null };
    }
    if (!data) return { ok: true, user: null };
    return { ok: true, user: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), user: null };
  }
}

/* ============================================================
   Propose a role change (creates a pending approval)
   ============================================================ */

/**
 * Insert a row in `approvals` for a role change. Does NOT
 * execute the change \u2014 that happens only after a GM approves.
 *
 * Payload shape:
 *   {
 *     target_user_id:  uuid,
 *     target_email:    string,   // denormalized for display
 *     current_role:    'gm'|'staff'|null,
 *     new_role:        'gm'|'staff',
 *     reason:          string|null
 *   }
 */
export async function proposeRoleChange({
  createdBy, targetUserId, targetEmail, currentRole, newRole, reason,
}) {
  if (!createdBy)     return { ok: false, error: "Not signed in." };
  if (!targetUserId)  return { ok: false, error: "Target user id required." };
  if (!targetEmail)   return { ok: false, error: "Target email required." };
  if (!["gm", "staff"].includes(newRole)) {
    return { ok: false, error: "New role must be 'gm' or 'staff'." };
  }
  if (currentRole === newRole) {
    return { ok: false, error: "Role is already " + newRole + "." };
  }

  const payload = {
    target_user_id: targetUserId,
    target_email:   targetEmail,
    current_role:   currentRole || null,
    new_role:       newRole,
    reason:         reason || null,
  };

  return createApproval({
    actionType: "admin_role_change",
    payload,
    createdBy,
  });
}

/* ============================================================
   Execute an approved role change
   ============================================================ */

/**
 * Called by the GM Portal after decideApproval marks the
 * approval as 'approved'. Applies the actual role change.
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
        { user_id: payload.target_user_id, role: payload.new_role },
        { onConflict: "user_id" }
      );

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}