import { useEffect, useState } from "react";
import {
  AlertTriangle, Check, Loader2, Mail, ShieldCheck, UserCog, UserPlus,
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import {
  fetchAdminTeam, findAuthUserByEmail, proposeRoleChange,
} from "../../lib/adminTeamClient.js";

/**
 * AdminTeam  \u2014  /admin/team
 *
 * Lists everyone with an admin role and lets any admin propose
 * role changes. Proposals do NOT execute directly \u2014 they land
 * in the GM Approvals queue for GM sign-off.
 *
 * Two sections:
 *   1. Current team \u2014 table of existing admins with a
 *      "Change role" action per row
 *   2. Add existing user \u2014 look up an auth user by email,
 *      propose granting them a first role
 *
 * NOT included in this session:
 *   \u00B7 Creating brand-new auth accounts (do that via Supabase
 *     Dashboard \u2192 Authentication \u2192 Users \u2192 Add user)
 *   \u00B7 Removing an admin (only role changes)
 *   \u00B7 Direct role edits (everything goes through approvals)
 */
export default function AdminTeam() {
  const { admin } = useAdmin();
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [changeTarget, setChangeTarget] = useState(null); // row being edited
  const [newRole, setNewRole] = useState("staff");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { kind: 'ok'|'err', message }

  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("staff");
  const [addLooking, setAddLooking] = useState(false);
  const [addFeedback, setAddFeedback] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchAdminTeam();
      if (cancelled) return;
      if (res.ok) {
        setTeam(res.rows);
        setLoadError(null);
      } else {
        setLoadError(res.error || "Couldn't load team.");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  async function refreshTeam() {
    const res = await fetchAdminTeam();
    if (res.ok) setTeam(res.rows);
  }

  /* ---- Propose role change for an existing admin ---- */
  async function submitRoleChange() {
    if (!changeTarget || !admin?.id) return;
    setFeedback(null);
    setSubmitting(true);
    const res = await proposeRoleChange({
      createdBy:    admin.id,
      targetUserId: changeTarget.user_id,
      targetEmail:  changeTarget.email,
      currentRole:  changeTarget.role,
      newRole,
      reason,
    });
    setSubmitting(false);
    if (res.ok) {
      setFeedback({ kind: "ok", message: "Change submitted. Awaiting GM approval." });
      setTimeout(() => {
        setChangeTarget(null);
        setReason("");
        setFeedback(null);
      }, 1500);
    } else {
      setFeedback({ kind: "err", message: res.error || "Couldn't submit." });
    }
  }

  /* ---- Propose adding an existing auth user as an admin ---- */
  async function submitAdd() {
    setAddFeedback(null);
    if (!addEmail.trim() || !admin?.id) return;
    setAddLooking(true);

    const lookup = await findAuthUserByEmail(addEmail);
    if (!lookup.ok) {
      setAddLooking(false);
      setAddFeedback({ kind: "err", message: lookup.error || "Lookup failed." });
      return;
    }
    if (!lookup.user) {
      setAddLooking(false);
      setAddFeedback({
        kind: "err",
        message: "No auth user with that email. Create the account first in Supabase Auth."
      });
      return;
    }

    // Check if they already have a role
    const existing = team.find((t) => t.user_id === lookup.user.user_id);
    if (existing) {
      setAddLooking(false);
      setAddFeedback({
        kind: "err",
        message: `That user already has role '${existing.role}'. Use "Change role" instead.`
      });
      return;
    }

    const res = await proposeRoleChange({
      createdBy:    admin.id,
      targetUserId: lookup.user.user_id,
      targetEmail:  lookup.user.email,
      currentRole:  null,
      newRole:      addRole,
      reason:       null,
    });
    setAddLooking(false);
    if (res.ok) {
      setAddFeedback({
        kind: "ok",
        message: "Proposal submitted. GM approval required."
      });
      setAddEmail("");
    } else {
      setAddFeedback({ kind: "err", message: res.error || "Couldn't submit." });
    }
  }

  if (loading) {
    return <div className="adm-page"><div className="hb__loading">Loading team\u2026</div></div>;
  }

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Team</h1>
          <p>Admins who have access to this console. Role changes require GM approval.</p>
        </div>
      </header>

      {loadError && <div className="team-warn">{loadError}</div>}

      {/* -------- Current team -------- */}
      <section className="team-section">
        <h2><UserCog size={16} /> Current team</h2>

        {team.length === 0 ? (
          <div className="team-empty">
            No admins yet. Add one below.
          </div>
        ) : (
          <table className="team-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>2FA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.user_id}>
                  <td>
                    <span className="team-email">{m.email}</span>
                    {m.user_id === admin?.id && <em className="team-you">You</em>}
                  </td>
                  <td>
                    <span className={"team-role team-role--" + m.role}>
                      {m.role === "gm" ? "GM" : "Staff"}
                    </span>
                  </td>
                  <td>
                    {m.totp_enrolled_at
                      ? <span className="team-2fa"><Check size={12} /> Enrolled</span>
                      : <span className="team-2fa team-2fa--off">Not set up</span>}
                  </td>
                  <td>
                    <button
                      className="adm-btn adm-btn--secondary"
                      onClick={() => {
                        setChangeTarget(m);
                        setNewRole(m.role === "gm" ? "staff" : "gm");
                        setReason("");
                        setFeedback(null);
                      }}
                    >
                      Change role
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* -------- Add existing user -------- */}
      <section className="team-section">
        <h2><UserPlus size={16} /> Add an existing user</h2>
        <p className="team-help">
          Grant an admin role to a user who already has a Supabase Auth account.
          To create a brand-new user, use Supabase Dashboard \u2192 Authentication \u2192 Users.
        </p>

        <div className="team-add">
          <div className="team-add__field">
            <label>Email</label>
            <div className="team-add__input">
              <Mail size={14} />
              <input
                type="email"
                placeholder="person@mynaven.com"
                value={addEmail}
                onChange={(e) => { setAddEmail(e.target.value); setAddFeedback(null); }}
                disabled={addLooking}
              />
            </div>
          </div>
          <div className="team-add__field">
            <label>Grant role</label>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              disabled={addLooking}
            >
              <option value="staff">Staff</option>
              <option value="gm">GM</option>
            </select>
          </div>
          <button
            className="adm-btn adm-btn--primary"
            onClick={submitAdd}
            disabled={addLooking || !addEmail.trim()}
          >
            {addLooking ? "Submitting\u2026" : "Propose"}
          </button>
        </div>

        {addFeedback && (
          <div className={"team-msg team-msg--" + addFeedback.kind}>
            {addFeedback.kind === "err" && <AlertTriangle size={13} />}
            {addFeedback.kind === "ok"  && <ShieldCheck size={13} />}
            {addFeedback.message}
          </div>
        )}
      </section>

      {/* -------- Change role modal -------- */}
      {changeTarget && (
        <div className="team-modal" onClick={() => !submitting && setChangeTarget(null)}>
          <div className="team-modal__card" onClick={(e) => e.stopPropagation()}>
            <h3>Change role</h3>
            <p>
              Propose changing <b>{changeTarget.email}</b> from{" "}
              <b>{changeTarget.role === "gm" ? "GM" : "Staff"}</b> to{" "}
              a new role. This proposal awaits GM approval.
            </p>

            <div className="team-modal__field">
              <label>New role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                disabled={submitting}
              >
                <option value="staff">Staff</option>
                <option value="gm">GM</option>
              </select>
            </div>

            <div className="team-modal__field">
              <label>Reason (optional)</label>
              <textarea
                rows={3}
                placeholder="Why is this change needed?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={submitting}
              />
            </div>

            {feedback && (
              <div className={"team-msg team-msg--" + feedback.kind}>
                {feedback.kind === "err" && <AlertTriangle size={13} />}
                {feedback.kind === "ok"  && <ShieldCheck size={13} />}
                {feedback.message}
              </div>
            )}

            <div className="team-modal__actions">
              <button
                className="adm-btn adm-btn--secondary"
                onClick={() => setChangeTarget(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="adm-btn adm-btn--primary"
                onClick={submitRoleChange}
                disabled={submitting || newRole === changeTarget.role}
              >
                {submitting
                  ? <><Loader2 size={13} className="waq-spin" /> Submitting\u2026</>
                  : "Submit for approval"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}