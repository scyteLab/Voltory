import { useState } from "react";
import {
  AlertTriangle, ArrowRight, Ban, Check, Gift, Loader2, ShieldCheck, Tag, User, X,
} from "lucide-react";
import { APPROVAL_LABELS } from "../../lib/approvalActions.js";
import { roleLabel } from "../../config/permissions.js";

const naira = (n) => (n == null ? "—" : "₦" + Number(n).toLocaleString("en-NG"));

/**
 * ApprovalCard  \u2014  renders one pending approval row
 *
 * Dispatches on `approval.action_type` to render an
 * action-appropriate summary. Action types and what approving
 * them does live in lib/approvalActions.js; add a case to the
 * switches below when you add a type there.
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
    case "price_change":
    case "price_bulk_change": return <Tag size={14} />;
    case "offer_change":      return <Gift size={14} />;
    case "order_cancel":      return <Ban size={14} />;
    default:                  return <ShieldCheck size={14} />;
  }
}

function renderTypeLabel(type) {
  return APPROVAL_LABELS[type] || type;
}

function PriceLine({ label, from, to, fromWas, toWas }) {
  return (
    <div className="apv-summary__change">
      {label && <span className="apv-summary__email">{label}</span>}
      <span>{naira(from)}{fromWas ? <s style={{ marginLeft: 6, opacity: 0.6 }}>{naira(fromWas)}</s> : null}</span>
      <ArrowRight size={14} />
      <b>{naira(to)}</b>
      {toWas ? <s style={{ marginLeft: 6, opacity: 0.6 }}>{naira(toWas)}</s> : null}
    </div>
  );
}

const OFFER_OPS = { create: "Create offer", update: "Edit offer", delete: "Delete offer", toggle: "Pause / resume offer" };

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
              {roleLabel(p.current_role)}
            </span>
            <ArrowRight size={14} />
            <span className={"apv-role apv-role--" + p.new_role}>
              {roleLabel(p.new_role)}
            </span>
          </div>
          {p.reason && (
            <div className="apv-summary__reason">
              <b>Reason:</b> {p.reason}
            </div>
          )}
        </div>
      );

    case "price_change":
      return (
        <div className="apv-summary">
          <div className="apv-summary__main">
            <span className="apv-summary__email">{p.name}</span> <small className="adm-mono">{p.sku}</small>
          </div>
          <PriceLine from={p.current_price} to={p.new_price} fromWas={p.current_was} toWas={p.new_was} />
        </div>
      );

    case "price_bulk_change": {
      const rows = p.rows || [];
      return (
        <div className="apv-summary">
          <div className="apv-summary__main">
            <span className="apv-summary__email">{rows.length} product{rows.length === 1 ? "" : "s"}</span>
            {p.source && <small> · {p.source}</small>}
          </div>
          {rows.slice(0, 8).map((r) => (
            <PriceLine key={r.sku} label={r.sku} from={r.current_price} to={r.new_price} fromWas={r.current_was} toWas={r.new_was} />
          ))}
          {rows.length > 8 && <small>…and {rows.length - 8} more</small>}
        </div>
      );
    }

    case "offer_change":
      return (
        <div className="apv-summary">
          <div className="apv-summary__main">
            <span className="apv-summary__email">{OFFER_OPS[p.op] || p.op}: {p.label}</span>
          </div>
          {p.op === "toggle" && <div>{p.is_active ? "Resume (make live)" : "Pause"}</div>}
          {p.offer && (
            <div className="apv-summary__reason">
              {p.offer.title && <div><b>Title:</b> {p.offer.title}</div>}
              {p.offer.gift_description && <div><b>Gift:</b> {p.offer.gift_description}</div>}
              {p.offer.product_sku && <div><b>Product:</b> {p.offer.product_sku}</div>}
              {p.offer.ends_at && <div><b>Ends:</b> {new Date(p.offer.ends_at).toLocaleString("en-NG")}</div>}
              <div><b>Live:</b> {p.offer.is_active === false ? "No" : "Yes"}</div>
            </div>
          )}
        </div>
      );

    case "order_cancel":
      return (
        <div className="apv-summary">
          <div className="apv-summary__main">
            <span className="apv-summary__email">Cancel order <span className="adm-mono">{p.order_id}</span></span>
          </div>
          <div>{p.customer_name} · {naira(p.total)} · status when requested: {p.status}</div>
          {p.reason && <div className="apv-summary__reason"><b>Reason:</b> {p.reason}</div>}
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