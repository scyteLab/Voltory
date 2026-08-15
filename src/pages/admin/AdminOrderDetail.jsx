import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Ban, Check, Copy, CreditCard, MapPin,
  Phone, RefreshCw, RotateCcw, ShoppingCart, User,
} from "lucide-react";
import { fetchOrderWithItems, setOrderStatus } from "../../hooks/useOrders.js";
import { ORDER_STATUSES, PAYMENT_LABELS, STATUS_TRANSITIONS } from "../../config/orderStatus.js";
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
 * so operators never see an invalid next-state.
 */
export default function AdminOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null); // the target status while saving
  const [confirming, setConfirming] = useState(null); // target status while confirming

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
              </ul>
            </div>
          </div>

          {order.notes && (
            <div className="adm-widget">
              <header><div><b>Notes</b></div></header>
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