import { useState } from "react";
import {
  AlertTriangle, ArrowRight, Check, Loader2, ShieldCheck, User, X,
} from "lucide-react";

/**
 * ApprovalCard  \u2014  renders one pending approval row
 *
 * Dispatches on `approval.action_type` to render an
 * action-appropriate summary. Sub-session 2 handles
 * 'admin_role_change'. Future sessions add more types by
 * extending the switch below (and by wiring the exec logic
 * in GMPortal's handleApprove).
 *
 * Approve / Reject buttons are provided by the parent via
 * onDecide(id, decision, reason). The parent handles the
 * DB write + downstream action execution.
 */
export default function ApprovalCard({ approval, currentUserId, onDecide }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(null); // 'approving' | 'rejecting' | null
  const [error, setError] = useState(null);

  const isSelfProposal = approval.created_by === currentUserId;

  async function handleDecide(decision) {
    setError(null);
    setBusy(decision === "approved" ? "approving" : "rejecting");
    const res = await onDecide(approval.id, decision, reason);
    setBusy(null);
    if (!res.ok) setError(res.error || "Couldn't record decision.");
  }

  return (
    <div className="apv-card">
      <div className="apv-card__head">
        <div className="apv-card__badge">
          {renderTypeIcon(approval.action_type)}
          {renderTypeLabel(approval.action_type)}
        </div>
        <div className="apv-card__time">
          {formatRelative(approval.created_at)}
        </div>
      </div>

      <div className="apv-card__body">
        {renderSummary(approval)}
      </div>

      {isSelfProposal && (
        <div className="apv-card__self">
          <AlertTriangle size={13} />
          You proposed this. Another GM must approve or reject.
        </div>
      )}

      {!isSelfProposal && (
        <>
          <div className="apv-card__reason">
            <label>Reason (optional, shown in decision record)</label>
            <input
              type="text"
              placeholder="e.g. Verified via phone with proposer"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={busy != null}
            />
          </div>

          {error && (
            <div className="apv-card__err">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          <div className="apv-card__actions">
            <button
              className="adm-btn adm-btn--danger"
              onClick={() => handleDecide("rejected")}
              disabled={busy != null}
            >
              {busy === "rejecting"
                ? <><Loader2 size={13} className="waq-spin" /> Rejecting\u2026</>
                : <><X size={13} /> Reject</>}
            </button>
            <button
              className="adm-btn adm-btn--primary"
              onClick={() => handleDecide("approved")}
              disabled={busy != null}
            >
              {busy === "approving"
                ? <><Loader2 size={13} className="waq-spin" /> Approving\u2026</>
                : <><Check size={13} /> Approve</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Action-type dispatchers ------------------------------ */

function renderTypeIcon(type) {
  switch (type) {
    case "admin_role_change": return <User size={14} />;
    default:                  return <ShieldCheck size={14} />;
  }
}

function renderTypeLabel(type) {
  switch (type) {
    case "admin_role_change": return "Admin role change";
    default:                  return type;
  }
}

function renderSummary(approval) {
  const p = approval.payload || {};
  switch (approval.action_type) {
    case "admin_role_change":
      return (
        <div className="apv-summary">
          <div className="apv-summary__main">
            <span className="apv-summary__email">{p.target_email || "unknown"}</span>
          </div>
          <div className="apv-summary__change">
            <span className={"apv-role apv-role--" + (p.current_role || "none")}>
              {p.current_role ? (p.current_role === "gm" ? "GM" : "Staff") : "No role"}
            </span>
            <ArrowRight size={14} />
            <span className={"apv-role apv-role--" + p.new_role}>
              {p.new_role === "gm" ? "GM" : "Staff"}
            </span>
          </div>
          {p.reason && (
            <div className="apv-summary__reason">
              <b>Reason:</b> {p.reason}
            </div>
          )}
        </div>
      );

    default:
      return (
        <pre className="apv-summary__raw">
          {JSON.stringify(p, null, 2)}
        </pre>
      );
  }
}

function formatRelative(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now  = Date.now();
  const s = Math.floor((now - then) / 1000);
  if (s < 60)     return `${s}s ago`;
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}