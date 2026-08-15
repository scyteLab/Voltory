import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  AlertTriangle, Clock, Inbox, Lock, LockOpen, RefreshCw, ShieldCheck,
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useGMPortal } from "../../hooks/useGMPortal.js";
import { listApprovals, decideApproval } from "../../lib/gmPortalClient.js";
import { executeRoleChange } from "../../lib/adminTeamClient.js";
import ApprovalCard from "../../components/admin/ApprovalCard.jsx";

/**
 * GMPortal  \u2014  /admin/gm-portal
 *
 * States:
 *   'locked'   \u2014 TOTP unlock form
 *   'unlocked' \u2014 pending approvals queue + approve/reject
 *
 * On approve, we:
 *   1. Record the decision via decideApproval (also enforces
 *      two-person integrity: creator \u2260 decider)
 *   2. Execute the downstream action based on action_type
 *      (sub-session 2: only admin_role_change)
 *   3. Refresh the queue
 *
 * On reject, we only record the decision.
 *
 * If step 2 fails after step 1 succeeded, we surface the error
 * but the approval is already marked approved \u2014 the GM should
 * retry or intervene manually. Honest tradeoff: one round-trip
 * approach makes race handling simpler than a two-phase commit.
 */
export default function GMPortal() {
  const { admin, isGM, roleLoading, totpEnrolled } = useAdmin();
  const { state, unlock, lock } = useGMPortal();

  const [code, setCode]   = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [approvals, setApprovals] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState(null);

  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    const res = await listApprovals("pending");
    setQueueLoading(false);
    if (res.ok) {
      setApprovals(res.rows);
      setQueueError(null);
    } else {
      setQueueError(res.error || "Couldn't load queue.");
    }
  }, []);

  useEffect(() => {
    if (state === "unlocked") loadQueue();
  }, [state, loadQueue]);

  /* Guards --------------------------------------------------- */

  if (roleLoading) {
    return <div className="adm-page"><div className="hb__loading">Checking access\u2026</div></div>;
  }
  if (!isGM) return <Navigate to="/admin" replace />;
  if (!totpEnrolled) return <Navigate to="/admin/gm-setup" replace />;

  /* ---- Lock state: TOTP unlock ---- */

  async function onSubmitUnlock(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await unlock(code);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Couldn't unlock. Try again.");
      setCode("");
      return;
    }
    setCode("");
  }

  if (state === "locked") {
    return (
      <div className="adm-page adm-gm-locked">
        <div className="adm-gm-locked__card">
          <div className="adm-gm-locked__icon">
            <Lock size={32} />
          </div>
          <h1>GM Approvals Portal</h1>
          <p>
            Enter the current 6-digit code from your authenticator to unlock.
            Session stays open for 30 minutes of activity.
          </p>

          <form onSubmit={onSubmitUnlock}>
            <label>
              <span className="adm-gm-locked__lbl">Authenticator code</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                disabled={submitting}
                autoFocus
              />
            </label>

            {error && (
              <div className="adm-gm-locked__err">
                <AlertTriangle size={13} /> {error}
              </div>
            )}

            <button
              type="submit"
              className="adm-btn adm-btn--primary"
              disabled={submitting || code.length !== 6}
            >
              {submitting ? "Verifying\u2026" : "Unlock"}
              <LockOpen size={14} />
            </button>
          </form>

          <p className="adm-gm-locked__hint">
            Lost access to your authenticator?{" "}
            <Link to="/admin/gm-setup">Re-enroll here</Link>{" "}
            (requires signing in first).
          </p>
        </div>
      </div>
    );
  }

  /* ---- Unlocked: queue + decide ---- */

  async function handleDecide(approvalId, decision, reason) {
    // Step 1: record the decision
    const decideRes = await decideApproval({
      id:        approvalId,
      decision,
      decidedBy: admin.id,
      reason,
    });
    if (!decideRes.ok) return decideRes;

    // Step 2: execute downstream action if approved
    if (decision === "approved") {
      const approval = approvals.find((a) => a.id === approvalId);
      if (approval) {
        const execRes = await executeApprovedAction(approval);
        if (!execRes.ok) {
          // Approval is already marked; surface the exec error
          // so the GM can intervene manually.
          await loadQueue();
          return {
            ok: false,
            error: "Decision recorded, but executing the change failed: " + execRes.error,
          };
        }
      }
    }

    await loadQueue();
    return { ok: true };
  }

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>
            <ShieldCheck size={22} style={{ verticalAlign: "-4px", marginRight: 8, color: "var(--adm-brand)" }} />
            GM Approvals
          </h1>
          <p>Pending actions awaiting your sign-off. Session auto-locks after 30 minutes of inactivity.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="adm-btn adm-btn--secondary" onClick={loadQueue}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="adm-btn adm-btn--secondary" onClick={lock}>
            <Lock size={13} /> Lock now
          </button>
        </div>
      </header>

      {queueError && (
        <div className="team-warn"><AlertTriangle size={13} /> {queueError}</div>
      )}

      {queueLoading ? (
        <div className="hb__loading">Loading approvals\u2026</div>
      ) : approvals.length === 0 ? (
        <div className="adm-gm-empty">
          <Inbox size={40} strokeWidth={1.2} />
          <h2>No pending approvals</h2>
          <p>
            When a staff member proposes something that requires your sign-off,
            it will appear here for you to approve or reject.
          </p>
          <div className="adm-gm-empty__note">
            <Clock size={13} />
            <span>Currently wired: admin role changes. More action types coming.</span>
          </div>
        </div>
      ) : (
        <div className="apv-list">
          {approvals.map((a) => (
            <ApprovalCard
              key={a.id}
              approval={a}
              currentUserId={admin.id}
              onDecide={handleDecide}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Downstream action executor
   ============================================================
   Dispatches on approval.action_type to run the actual DB
   change AFTER the GM has approved. Future sessions extend
   this switch with more action types.
*/
async function executeApprovedAction(approval) {
  switch (approval.action_type) {
    case "admin_role_change":
      return executeRoleChange(approval.payload);

    default:
      return {
        ok: false,
        error: `Unknown action type '${approval.action_type}'. Manual intervention required.`,
      };
  }
}