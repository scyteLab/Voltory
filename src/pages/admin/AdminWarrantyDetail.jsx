import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Ban, Check, Copy, ExternalLink,
  Package, Phone, RefreshCw, ShieldCheck, ShoppingCart, User,
} from "lucide-react";
import { fetchWarrantyWithContext, setWarrantyStatus } from "../../hooks/useWarranty.js";
import { WARRANTY_STATUSES, WARRANTY_TRANSITIONS } from "../../config/warrantyStatus.js";
import { ORDER_STATUSES } from "../../config/orderStatus.js";

function naira(n) { return "\u20A6" + Number(n || 0).toLocaleString("en-NG"); }
function fmtDateLong(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-NG", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
function toIntlPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("234")) return "+" + digits;
  if (digits.startsWith("0"))   return "+234" + digits.slice(1);
  return "+" + digits;
}

/**
 * Warranty claim detail page.
 *
 * Left: reason, resolution notes, status transitions.
 * Right: customer, linked product, linked order (both optional).
 */
export default function AdminWarrantyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null);
  const [confirming, setConfirming] = useState(null);

  // Resolution notes editor state \u2014 kept local so keystrokes don't hit DB
  const [resolutionDraft, setResolutionDraft] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesFlash, setNotesFlash] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWarrantyWithContext(id);
      if (!data) {
        setError("Warranty claim not found.");
        setClaim(null);
      } else {
        setClaim(data);
        setResolutionDraft(data.resolution || "");
        setNotesDirty(false);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function attemptTransition(target) {
    if (["rejected"].includes(target) && confirming !== target) {
      setConfirming(target);
      return;
    }
    setSaving(target);
    try {
      const updated = await setWarrantyStatus(id, target);
      setClaim((prev) => prev ? { ...prev, ...updated } : prev);
      setConfirming(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(null);
    }
  }

  async function saveNotes() {
    setNotesSaving(true);
    try {
      const updated = await setWarrantyStatus(id, claim.status, resolutionDraft);
      setClaim((prev) => prev ? { ...prev, ...updated } : prev);
      setNotesDirty(false);
      setNotesFlash(true);
      setTimeout(() => setNotesFlash(false), 2000);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setNotesSaving(false);
    }
  }

  async function copyId() {
    try { await navigator.clipboard.writeText(id); } catch { /* noop */ }
  }

  if (loading) {
    return (
      <div className="adm-page">
        <BackLink />
        <div className="adm-empty adm-empty--loading">Loading warranty claim…</div>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="adm-page">
        <BackLink />
        <div className="adm-empty adm-empty--err">
          <AlertTriangle size={32} />
          <b>{error || "Warranty claim not found."}</b>
          <button className="adm-btn adm-btn--secondary" onClick={load}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const status = claim.status;
  const statusMeta = WARRANTY_STATUSES[status];
  const allowedNext = WARRANTY_TRANSITIONS[status] || [];
  const intlPhone = toIntlPhone(claim.customer_phone);
  const waPhone = intlPhone.replace(/^\+/, "");

  return (
    <div className="adm-page adm-orderdetail">
      <BackLink />

      <header className="adm-orderdetail__head">
        <div>
          <div className="adm-orderdetail__title-row">
            <h1>Warranty Claim</h1>
            <span className="adm-mono adm-orderdetail__id">{claim.id}</span>
            <button
              className="adm-icon-btn adm-icon-btn--sm"
              onClick={copyId}
              aria-label="Copy claim ID"
              title="Copy claim ID"
            >
              <Copy size={13} />
            </button>
            <span className={"adm-chip " + statusMeta.chip}>{statusMeta.label}</span>
          </div>
          <p>Submitted {fmtDateLong(claim.created_at)} · Last updated {fmtDateLong(claim.updated_at)}</p>
        </div>
        <button className="adm-btn adm-btn--secondary" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </header>

      <div className="adm-orderdetail__split">
        {/* LEFT: reason, resolution, transitions */}
        <section className="adm-orderdetail__main">
          <div className="adm-widget">
            <header><div><b>Customer’s Reported Issue</b></div></header>
            <div className="adm-widget__body" style={{ padding: "16px 22px" }}>
              <p className="adm-warr__reason-full">{claim.reason}</p>
            </div>
          </div>

          <div className="adm-widget">
            <header>
              <div>
                <b>Status & Actions</b>
                <small>Current: {statusMeta.label}</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: "16px 22px" }}>
              {allowedNext.length > 0 ? (
                <div className="adm-orderdetail__actions">
                  {allowedNext.map((target) => {
                    const targetMeta = WARRANTY_STATUSES[target];
                    const isConfirming = confirming === target;
                    const isSaving = saving === target;
                    return (
                      <TransitionButton
                        key={target}
                        target={target}
                        label={targetMeta.label}
                        isConfirming={isConfirming}
                        isSaving={isSaving}
                        onFire={() => attemptTransition(target)}
                        onCancel={() => setConfirming(null)}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="adm-orderdetail__terminal">
                  This claim has reached a terminal state ({statusMeta.label.toLowerCase()}). No further transitions are available.
                </p>
              )}
            </div>
          </div>

          <div className="adm-widget">
            <header>
              <div>
                <b>Resolution Notes</b>
                <small>Internal record of investigation and outcome</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: "16px 22px" }}>
              <textarea
                className="adm-warr__notes"
                rows={5}
                value={resolutionDraft}
                onChange={(e) => { setResolutionDraft(e.target.value); setNotesDirty(true); }}
                placeholder="What did we find? What did we do? Include dates, part numbers, replacement SKUs, or refund amounts."
              />
              <div className="adm-warr__notes-foot">
                {notesFlash && <span className="adm-warr__notes-flash"><Check size={13} /> Saved</span>}
                <button
                  className="adm-btn adm-btn--primary"
                  disabled={!notesDirty || notesSaving}
                  onClick={saveNotes}
                >
                  {notesSaving ? "Saving\u2026" : "Save notes"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: customer, product, linked order */}
        <aside className="adm-orderdetail__side">
          <div className="adm-widget">
            <header><div><b>Customer</b></div></header>
            <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
              <ul className="adm-kvlist">
                <li><User size={13} /> <span>{claim.customer_name}</span></li>
                <li><Phone size={13} /> <span className="adm-mono">{claim.customer_phone}</span></li>
              </ul>
              <div className="adm-cust__actions">
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank" rel="noreferrer"
                  className="adm-btn adm-btn--primary adm-btn--wa"
                >
                  WhatsApp
                </a>
                <a href={`tel:${intlPhone}`} className="adm-btn adm-btn--secondary">Call</a>
              </div>
            </div>
          </div>

          {claim.product && (
            <div className="adm-widget">
              <header><div><b>Product</b></div></header>
              <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
                <div className="adm-warr__prod">
                  <span className="adm-warr__prod-thumb">
                    {claim.product.image
                      ? <img src={claim.product.image} alt="" onError={(e) => { e.target.style.display = "none"; }} />
                      : <Package size={16} />}
                  </span>
                  <div>
                    <b>{claim.product.name}</b>
                    <small>SKU <span className="adm-mono">{claim.product.sku}</span></small>
                    <small>{claim.product.brand} · {naira(claim.product.price)}</small>
                  </div>
                </div>
                <button
                  className="adm-btn adm-btn--secondary"
                  onClick={() => navigate(`/admin/products?focus=${encodeURIComponent(claim.product.sku)}`)}
                  style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
                >
                  Open product <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}

          {claim.order && (
            <div className="adm-widget">
              <header><div><b>Linked Order</b></div></header>
              <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
                <ul className="adm-kvlist">
                  <li>
                    <ShoppingCart size={13} />
                    <span className="adm-mono">{claim.order.id}</span>
                  </li>
                  <li>
                    <span aria-hidden="true">₦</span>
                    <span><b>{naira(claim.order.total)}</b></span>
                  </li>
                  <li>
                    <span aria-hidden="true">○</span>
                    <span className={"adm-chip " + (ORDER_STATUSES[claim.order.status]?.chip || "adm-chip--info")}>
                      {ORDER_STATUSES[claim.order.status]?.label || claim.order.status}
                    </span>
                  </li>
                </ul>
                <button
                  className="adm-btn adm-btn--secondary"
                  onClick={() => navigate(`/admin/orders/${claim.order.id}`)}
                  style={{ width: "100%", justifyContent: "center", marginTop: 10 }}
                >
                  Open order <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <div style={{ marginBottom: 14 }}>
      <Link to="/admin/warranty" className="adm-orderdetail__back">
        <ArrowLeft size={13} /> Back to warranty claims
      </Link>
    </div>
  );
}

function TransitionButton({ target, label, isConfirming, isSaving, onFire, onCancel }) {
  const isDestructive = target === "rejected";
  const Icon = target === "rejected" ? Ban : target === "resolved" ? ShieldCheck : Check;

  if (isConfirming) {
    return (
      <span className="adm-orderdetail__confirm">
        <b>Confirm rejection?</b>
        <button className="adm-btn adm-btn--secondary" onClick={onCancel} disabled={isSaving}>
          Keep as is
        </button>
        <button className="adm-btn adm-btn--danger" onClick={onFire} disabled={isSaving}>
          {isSaving ? "Working\u2026" : "Yes, reject"}
        </button>
      </span>
    );
  }

  return (
    <button
      className={"adm-btn " + (isDestructive ? "adm-btn--ghost-danger" : "adm-btn--primary")}
      onClick={onFire}
      disabled={isSaving}
    >
      <Icon size={13} /> {isSaving ? `\u2192 ${label}\u2026` : `Mark as ${label}`}
    </button>
  );
}