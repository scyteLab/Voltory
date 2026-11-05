import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Check, KeyRound, Loader2, Mail, ShieldCheck, UserCog, UserPlus,
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import {
  addStaffMember, changeStaffRole, deactivateStaff, fetchAdminTeam, reactivateStaff, removeStaff,
} from "../../lib/adminTeamClient.js";
import { ASSIGNABLE_ROLES, ROLES, normaliseRole, roleLabel } from "../../config/permissions.js";

/**
 * AdminTeam  —  /admin/team  (GM only: team.manage)
 *
 * Who has which role, plus:
 *   · Add a staff member: email + role + temporary password. Creates
 *     the sign-in account (or gives an existing account a role).
 *   · Change role, deactivate / reactivate (blocks sign-in, keeps
 *     the row), remove (deletes the role, blocks sign-in).
 *
 * All of it runs in the admin-team Netlify function, which re-checks
 * the caller is the GM. The GM can't change their own account here.
 */

/** 14 random characters, no look-alikes (0/O, 1/l/I). */
function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function fmtDate(iso) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminTeam() {
  const { admin } = useAdmin();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [rowBusy, setRowBusy] = useState(null); // user_id while an action runs
  const [rowMsg, setRowMsg] = useState(null);    // { kind, message }

  const [changeTarget, setChangeTarget] = useState(null);
  const [newRole, setNewRole] = useState("store");
  const [confirm, setConfirm] = useState(null);  // { member, action: 'deactivate'|'remove' }

  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("store");
  const [addPassword, setAddPassword] = useState(randomPassword);
  const [adding, setAdding] = useState(false);
  const [addFeedback, setAddFeedback] = useState(null);

  const load = useCallback(async () => {
    const res = await fetchAdminTeam();
    if (res.ok) {
      setTeam(res.rows || []);
      setLoadError(null);
    } else {
      setLoadError(res.error || "Couldn't load the team.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runRowAction(member, fn, okMessage) {
    setRowBusy(member.user_id);
    setRowMsg(null);
    const res = await fn();
    setRowBusy(null);
    if (res.ok) {
      setRowMsg({ kind: "ok", message: okMessage });
      await load();
    } else {
      setRowMsg({ kind: "err", message: res.error || "That didn't work." });
    }
    return res;
  }

  async function submitRoleChange() {
    if (!changeTarget) return;
    const res = await runRowAction(
      changeTarget,
      () => changeStaffRole(changeTarget.user_id, newRole),
      `${changeTarget.email} is now ${roleLabel(newRole)}.`,
    );
    if (res.ok) setChangeTarget(null);
  }

  async function submitConfirm() {
    if (!confirm) return;
    const { member, action } = confirm;
    const res = action === "remove"
      ? await runRowAction(member, () => removeStaff(member.user_id), `${member.email} was removed and can no longer sign in.`)
      : await runRowAction(member, () => deactivateStaff(member.user_id), `${member.email} is deactivated and can no longer sign in.`);
    if (res.ok) setConfirm(null);
  }

  async function submitAdd(e) {
    e.preventDefault();
    setAddFeedback(null);
    setAdding(true);
    const email = addEmail.trim().toLowerCase();
    const res = await addStaffMember({ email, role: addRole, password: addPassword });
    setAdding(false);
    if (!res.ok) {
      setAddFeedback({ kind: "err", message: res.error || "Couldn't add them." });
      return;
    }
    setAddFeedback({
      kind: "ok",
      message: `${email} added as ${roleLabel(addRole)}${res.existed ? " (existing account)" : ""}. `
        + `Share the temporary password privately: ${addPassword} — they should change it after signing in (key icon, top right).`,
    });
    setAddEmail("");
    setAddPassword(randomPassword());
    await load();
  }

  if (loading) {
    return <div className="adm-page"><div className="hb__loading">Loading team…</div></div>;
  }

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Team</h1>
          <p>Who can use this console, and what their role lets them do.</p>
        </div>
      </header>

      {loadError && (
        <div className="team-warn">
          <AlertTriangle size={13} /> {loadError}
          {" "}(If this mentions <code>deactivated_at</code>, run <code>supabase/admin_roles_update.sql</code> first.)
        </div>
      )}

      <section className="team-section">
        <h2><ShieldCheck size={16} /> Roles</h2>
        <ul className="team-roles-legend">
          {ASSIGNABLE_ROLES.map((r) => (
            <li key={r}><b>{ROLES[r].label}:</b> {ROLES[r].description}</li>
          ))}
        </ul>
      </section>

      {/* -------- Current team -------- */}
      <section className="team-section">
        <h2><UserCog size={16} /> Current team</h2>

        {rowMsg && (
          <div className={"team-msg team-msg--" + rowMsg.kind}>
            {rowMsg.kind === "err" ? <AlertTriangle size={13} /> : <Check size={13} />} {rowMsg.message}
          </div>
        )}

        {team.length === 0 ? (
          <div className="team-empty">No one yet. Add a staff member below.</div>
        ) : (
          <table className="team-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>2FA</th>
                <th>Last sign-in</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => {
                const isYou = m.user_id === admin?.id;
                const off = Boolean(m.deactivated_at);
                const busy = rowBusy === m.user_id;
                const role = normaliseRole(m.role) || "none";
                return (
                  <tr key={m.user_id} className={off ? "team-row--off" : ""}>
                    <td>
                      <span className="team-email">{m.email}</span>
                      {isYou && <em className="team-you">You</em>}
                      {off && <span className="team-off">Deactivated</span>}
                    </td>
                    <td><span className={"team-role team-role--" + role}>{roleLabel(m.role)}</span></td>
                    <td>
                      {m.totp_enrolled
                        ? <span className="team-2fa"><Check size={12} /> Enrolled</span>
                        : <span className="team-2fa team-2fa--off">{role === "gm" ? "Not set up" : "—"}</span>}
                    </td>
                    <td>{fmtDate(m.last_sign_in_at)}</td>
                    <td>
                      {isYou ? (
                        <span className="team-help" title="You can't change your own account here.">—</span>
                      ) : (
                        <div className="team-actions">
                          {busy && <Loader2 size={14} className="waq-spin" />}
                          {!off && (
                            <button
                              className="adm-btn adm-btn--secondary"
                              disabled={busy}
                              onClick={() => {
                                setChangeTarget(m);
                                setNewRole(ASSIGNABLE_ROLES.find((r) => r !== role) || "store");
                              }}
                            >
                              Change role
                            </button>
                          )}
                          {off ? (
                            <button
                              className="adm-btn adm-btn--secondary"
                              disabled={busy}
                              onClick={() => runRowAction(m, () => reactivateStaff(m.user_id), `${m.email} can sign in again.`)}
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              className="adm-btn adm-btn--secondary"
                              disabled={busy}
                              onClick={() => setConfirm({ member: m, action: "deactivate" })}
                            >
                              Deactivate
                            </button>
                          )}
                          <button
                            className="adm-btn adm-btn--secondary"
                            disabled={busy}
                            onClick={() => setConfirm({ member: m, action: "remove" })}
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* -------- Add staff member -------- */}
      <section className="team-section">
        <h2><UserPlus size={16} /> Add a staff member</h2>
        <p className="team-help">
          Creates their sign-in account with a temporary password (or gives an existing
          account a role). They sign in at <b>/admin/login</b> and should change the password straight away.
        </p>

        <form className="team-add" onSubmit={submitAdd}>
          <div className="team-add__field">
            <label>Email</label>
            <div className="team-add__input">
              <Mail size={14} />
              <input
                type="email"
                placeholder="store@mynaven.com"
                value={addEmail}
                onChange={(e) => { setAddEmail(e.target.value); setAddFeedback(null); }}
                disabled={adding}
                required
              />
            </div>
          </div>
          <div className="team-add__field">
            <label>Role</label>
            <select value={addRole} onChange={(e) => setAddRole(e.target.value)} disabled={adding}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
            </select>
          </div>
          <div className="team-add__field">
            <label>Temporary password</label>
            <div className="team-add__input">
              <KeyRound size={14} />
              <input
                type="text"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                disabled={adding}
                minLength={10}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
          </div>
          <button className="adm-btn adm-btn--primary" type="submit" disabled={adding || !addEmail.trim()}>
            {adding ? "Adding…" : "Add"}
          </button>
        </form>

        {addFeedback && (
          <div className={"team-msg team-msg--" + addFeedback.kind}>
            {addFeedback.kind === "err" ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
            {addFeedback.message}
          </div>
        )}
      </section>

      {/* -------- Change role modal -------- */}
      {changeTarget && (
        <div className="team-modal" onClick={() => !rowBusy && setChangeTarget(null)}>
          <div className="team-modal__card" onClick={(e) => e.stopPropagation()}>
            <h3>Change role</h3>
            <p>
              <b>{changeTarget.email}</b> is currently <b>{roleLabel(changeTarget.role)}</b>.
              The change applies the next time their page loads.
            </p>
            <div className="team-modal__field">
              <label>New role</label>
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} disabled={!!rowBusy}>
                {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
              </select>
            </div>
            <p className="team-help">{ROLES[newRole]?.description}</p>
            <div className="team-modal__actions">
              <button className="adm-btn adm-btn--secondary" onClick={() => setChangeTarget(null)} disabled={!!rowBusy}>
                Cancel
              </button>
              <button
                className="adm-btn adm-btn--primary"
                onClick={submitRoleChange}
                disabled={!!rowBusy || newRole === normaliseRole(changeTarget.role)}
              >
                {rowBusy ? "Saving…" : "Save role"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------- Deactivate / remove confirm -------- */}
      {confirm && (
        <div className="team-modal" onClick={() => !rowBusy && setConfirm(null)}>
          <div className="team-modal__card" onClick={(e) => e.stopPropagation()}>
            <h3>{confirm.action === "remove" ? "Remove from team" : "Deactivate account"}</h3>
            <p>
              {confirm.action === "remove"
                ? <>Remove <b>{confirm.member.email}</b>&rsquo;s role and block their sign-in? You can add them again later.</>
                : <>Block <b>{confirm.member.email}</b> from signing in? Their role is kept so you can reactivate them later.</>}
            </p>
            <div className="team-modal__actions">
              <button className="adm-btn adm-btn--secondary" onClick={() => setConfirm(null)} disabled={!!rowBusy}>
                Cancel
              </button>
              <button className="adm-btn adm-btn--primary" onClick={submitConfirm} disabled={!!rowBusy}>
                {rowBusy ? "Working…" : confirm.action === "remove" ? "Remove" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
