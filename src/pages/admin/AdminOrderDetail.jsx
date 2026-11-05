import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Ban, Check, Copy, CreditCard, MapPin,
  Phone, RefreshCw, RotateCcw, ShoppingCart, User,
} from "lucide-react";
import { fetchOrderWithItems, setOrderAdminNote, setOrderStatus } from "../../hooks/useOrders.js";
import { useAdmin } from "../../context/AdminContext.jsx";
import { NO_ACCESS_TIP, usePermission } from "../../lib/permissions.js";
import { requestOrderCancel } from "../../lib/approvalActions.js";
import { ORDER_STATUSES, PAYMENT_LABELS, STATUS_TRANSITIONS, paymentStateChip } from "../../config/orderStatus.js";
import OrderStatusTimeline from "../../components/admin/OrderStatusTimeline.jsx";

function naira(n) { return "₦" + Number(n || 0).toLocaleString("en-NG"); }
function fmtDateLong(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-NG", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Admin Order Detail page — the operator's fulfillment workspace
 * for a single order.
 *
 * Left column: status timeline + line items + totals summary.
 * Right column: customer, address, payment, action buttons.
 * The available action buttons are computed from STATUS_TRANSITIONS
 * so operators never see an invalid next-state, then filtered by
 * role: cancel / refund are GM-only; Store gets "Request
 * cancellation" (a GM approval) instead; Support only views and
 * adds internal notes.
 */
export default function AdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null); // the target status while saving
  const [confirming, setConfirming] = useState(null); // target status while confirming
  const canUpdateStatus  = usePermission("orders.updateStatus");
  const canCancel        = usePermission("orders.cancel");
  const canRefund        = usePermission("orders.refund");
  const canRequestCancel = usePermission("orders.requestCancel");
  const canNotes         = usePermission("orders.notes");
  const mayFire = (target) =>
    target === "cancelled" ? canCancel : target === "refunded" ? canRefund : canUpdateStatus;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrderWithItems(id);
      if (!data) {
        setError("Order not found.");
        setOrder(null);
      } else {
        setOrder(data);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const attemptTransition = useCallback(async (target) => {
    // Some transitions require inline confirmation before firing
    if (["cancelled", "refunded"].includes(target) && confirming !== target) {
      setConfirming(target);
      return;
    }
    setSaving(target);
    try {
      const updated = await setOrderStatus(id, target);
      setOrder((prev) => prev ? { ...prev, ...updated } : prev);
      setConfirming(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setSaving(null);
    }
  }, [id, confirming]);

  async function copyOrderId() {
    try { await navigator.clipboard.writeText(id); } catch { /* noop */ }
  }

  if (loading) {
    return (
      <div className="adm-page">
        <PageBackLink />
        <div className="adm-empty adm-empty--loading">Loading order…</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="adm-page">
        <PageBackLink />
        <div className="adm-empty adm-empty--err">
          <AlertTriangle size={32} />
          <b>{error || "Order not found."}</b>
          <button className="adm-btn adm-btn--secondary" onClick={load}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const status = order.status;
  const statusMeta = ORDER_STATUSES[status];
  const allowedNext = STATUS_TRANSITIONS[status] || [];
  const address = order.address || {};

  return (
    <div className="adm-page adm-orderdetail">
      <PageBackLink />

      <header className="adm-orderdetail__head">
        <div>
          <div className="adm-orderdetail__title-row">
            <h1>Order</h1>
            <span className="adm-mono adm-orderdetail__id">{order.id}</span>
            <button
              className="adm-icon-btn adm-icon-btn--sm"
              onClick={copyOrderId}
              aria-label="Copy order ID"
              title="Copy order ID"
            >
              <Copy size={13} />
            </button>
            <span className={"adm-chip " + statusMeta.chip}>{statusMeta.label}</span>
          </div>
          <p>Placed {fmtDateLong(order.created_at)} · Last updated {fmtDateLong(order.updated_at)}</p>
        </div>
        <button className="adm-btn adm-btn--secondary" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </header>

      <div className="adm-orderdetail__split">
        {/* LEFT: timeline + items + totals */}
        <section className="adm-orderdetail__main">
          <div className="adm-widget">
            <header>
              <div>
                <b>Fulfillment Status</b>
                <small>Current: {statusMeta.label}</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: "20px 22px" }}>
              <OrderStatusTimeline status={status} />

              {allowedNext.length > 0 && (
                <div className="adm-orderdetail__actions">
                  {allowedNext.map((target) => {
                    const targetMeta = ORDER_STATUSES[target];
                    const isConfirming = confirming === target;
                    const isSaving = saving === target;
                    if (!mayFire(target)) {
                      if (target === "cancelled" && canRequestCancel) {
                        return <RequestCancelButton key={target} order={order} />;
                      }
                      return (
                        <button key={target} className="adm-btn adm-btn--secondary" disabled title={NO_ACCESS_TIP}>
                          Mark as {targetMeta.label}
                        </button>
                      );
                    }
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
              )}
              {allowedNext.length === 0 && (
                <p className="adm-orderdetail__terminal">
                  This order has reached a terminal state. No further status changes are available.
                </p>
              )}
            </div>
          </div>

          <div className="adm-widget">
            <header>
              <div>
                <b>Line Items</b>
                <small>{order.items.length} product{order.items.length === 1 ? "" : "s"}</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: 0 }}>
              <ul className="adm-lineitems">
                {order.items.map((it) => (
                  <li key={it.sku}>
                    <div className="adm-lineitems__thumb"><ShoppingCart size={16} /></div>
                    <div className="adm-lineitems__meta">
                      <b>{it.product_name}</b>
                      <small>SKU <span className="adm-mono">{it.sku}</span> · {naira(it.unit_price)} each</small>
                    </div>
                    <span className="adm-lineitems__qty">× {it.qty}</span>
                    <span className="adm-lineitems__total">{naira(it.line_total)}</span>
                  </li>
                ))}
                {order.items.length === 0 && (
                  <li className="adm-lineitems__empty">No line items on this order.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="adm-widget">
            <header><div><b>Order Totals</b></div></header>
            <div className="adm-widget__body" style={{ padding: "14px 22px" }}>
              <dl className="adm-totals">
                <div><dt>Subtotal</dt><dd>{naira(order.subtotal)}</dd></div>
                {order.discount > 0 && (
                  <div><dt>Discount</dt><dd className="adm-totals--minus">− {naira(order.discount)}</dd></div>
                )}
                <div><dt>Delivery Fee</dt><dd>{order.delivery_fee > 0 ? naira(order.delivery_fee) : "Free"}</dd></div>
                {order.installation_fee > 0 && (
                  <div><dt>Installation Fee</dt><dd>{naira(order.installation_fee)}</dd></div>
                )}
                <div className="adm-totals__grand">
                  <dt>Total Charged</dt><dd>{naira(order.total)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* RIGHT: customer, address, payment */}
        <aside className="adm-orderdetail__side">
          <div className="adm-widget">
            <header><div><b>Customer</b></div></header>
            <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
              <ul className="adm-kvlist">
                <li><User size={13} /> <span>{order.customer_name}</span></li>
                <li><Phone size={13} /> <span className="adm-mono">{order.customer_phone}</span></li>
                {order.customer_email && (
                  <li><span aria-hidden="true">@</span> <span>{order.customer_email}</span></li>
                )}
              </ul>
            </div>
          </div>

          <div className="adm-widget">
            <header><div><b>Delivery Address</b></div></header>
            <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
              {Object.keys(address).length === 0 ? (
                <p className="adm-kvlist__empty">No address recorded.</p>
              ) : (
                <ul className="adm-kvlist">
                  {address.street && <li><MapPin size={13} /> <span>{address.street}</span></li>}
                  {address.area && <li><span aria-hidden="true">○</span> <span>{address.area}</span></li>}
                  {address.state && <li><span aria-hidden="true">○</span> <span>{address.state}</span></li>}
                </ul>
              )}
            </div>
          </div>

          <div className="adm-widget">
            <header><div><b>Payment</b></div></header>
            <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
              <ul className="adm-kvlist">
                <li>
                  <CreditCard size={13} />
                  <span>{PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
                </li>
                <li>
                  <span aria-hidden="true">₦</span>
                  <span><b>{naira(order.total)}</b></span>
                </li>
                <li>
                  <span aria-hidden="true">○</span>
                  <span className={"adm-chip " + paymentStateChip(order).chip}>{paymentStateChip(order).label}</span>
                </li>
                {order.paystack_ref && (
                  <li>
                    <span aria-hidden="true">#</span>
                    <span className="adm-mono" style={{ fontSize: 11.5, wordBreak: "break-all" }}>{order.paystack_ref}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <InternalNotes order={order} canEdit={canNotes} onSaved={(admin_note) => setOrder((o) => ({ ...o, admin_note }))} />

          {order.notes && (
            <div className="adm-widget">
              <header><div><b>Customer notes</b></div></header>
              <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
                <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--adm-ink-2)" }}>{order.notes}</p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** Store: ask the GM to cancel (creates an order_cancel approval). */
function RequestCancelButton({ order }) {
  const { admin } = useAdmin();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await requestOrderCancel({ createdBy: admin?.id, order, reason });
    setBusy(false);
    if (res.ok) {
      setMsg({ kind: "ok", text: "Sent to the GM for approval." });
      setOpen(false);
      setReason("");
    } else {
      setMsg({ kind: "err", text: res.error || "Couldn't send the request." });
    }
  }

  const msgStyle = (kind) => ({ color: kind === "ok" ? "var(--adm-ok, #047857)" : "var(--adm-err, #b91c1c)" });

  if (!open) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <button className="adm-btn adm-btn--ghost-danger" onClick={() => setOpen(true)} title="Cancelling needs the GM's approval">
          <Ban size={13} /> Request cancellation
        </button>
        {msg && <small style={msgStyle(msg.kind)}>{msg.text}</small>}
      </span>
    );
  }
  return (
    <span className="adm-orderdetail__confirm" style={{ flexWrap: "wrap" }}>
      <input
        type="text"
        placeholder="Reason (required)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        disabled={busy}
        maxLength={500}
        style={{ minWidth: 220, padding: "7px 10px", border: "1px solid var(--adm-border)", borderRadius: 6, font: "inherit" }}
        autoFocus
      />
      <button className="adm-btn adm-btn--secondary" onClick={() => setOpen(false)} disabled={busy}>Back</button>
      <button className="adm-btn adm-btn--danger" onClick={submit} disabled={busy || !reason.trim()}>
        {busy ? "Sending…" : "Send to GM"}
      </button>
      {msg && <small style={msgStyle(msg.kind)}>{msg.text}</small>}
    </span>
  );
}

/** Staff-only notes on the order (orders.admin_note). */
function InternalNotes({ order, canEdit, onSaved }) {
  const [draft, setDraft] = useState(order.admin_note || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const dirty = draft !== (order.admin_note || "");

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const saved = await setOrderAdminNote(order.id, draft.trim() || null);
      onSaved(saved.admin_note ?? null);
      setMsg({ kind: "ok", text: "Saved." });
    } catch (e) {
      setMsg({ kind: "err", text: e.message || "Couldn't save the note." });
    } finally {
      setBusy(false);
    }
  }

  if (!canEdit && !order.admin_note) return null;
  return (
    <div className="adm-widget">
      <header><div><b>Internal notes</b><small>Only staff see these</small></div></header>
      <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
        {canEdit ? (
          <>
            <textarea
              rows={4}
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setMsg(null); }}
              maxLength={5000}
              disabled={busy}
              placeholder="Called the customer, delivery moved to Friday…"
              style={{ width: "100%", boxSizing: "border-box", padding: 10, border: "1px solid var(--adm-border)", borderRadius: 6, font: "inherit", fontSize: 13, resize: "vertical" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <button className="adm-btn adm-btn--primary" onClick={save} disabled={busy || !dirty}>
                {busy ? "Saving…" : "Save note"}
              </button>
              {msg && (
                <small style={{ color: msg.kind === "ok" ? "var(--adm-ok, #047857)" : "var(--adm-err, #b91c1c)" }}>
                  {msg.text}
                </small>
              )}
            </div>
          </>
        ) : (
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--adm-ink-2)", whiteSpace: "pre-wrap" }}>{order.admin_note}</p>
        )}
      </div>
    </div>
  );
}

function PageBackLink() {
  return (
    <div style={{ marginBottom: 14 }}>
      <Link to="/admin/orders" className="adm-orderdetail__back">
        <ArrowLeft size={13} /> Back to orders
      </Link>
    </div>
  );
}

function TransitionButton({ target, label, isConfirming, isSaving, onFire, onCancel }) {
  const isDestructive = ["cancelled", "refunded"].includes(target);
  const Icon = target === "cancelled" ? Ban : target === "refunded" ? RotateCcw : Check;

  if (isConfirming) {
    const verb = target === "cancelled" ? "cancel" : "refund";
    return (
      <span className="adm-orderdetail__confirm">
        <b>Confirm {verb}?</b>
        <button
          className="adm-btn adm-btn--secondary"
          onClick={onCancel}
          disabled={isSaving}
        >
          Keep as is
        </button>
        <button
          className="adm-btn adm-btn--danger"
          onClick={onFire}
          disabled={isSaving}
        >
          {isSaving ? "Working…" : `Yes, ${verb}`}
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
      <Icon size={13} /> {isSaving ? `→ ${label}…` : `Mark as ${label}`}
    </button>
  );
}