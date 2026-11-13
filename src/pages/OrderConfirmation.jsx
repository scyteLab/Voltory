import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  AlertCircle, BadgeCheck, Check, ChevronRight, CircleCheck, Cloud, CloudOff,
  CreditCard, Home as HomeIcon, Mail, MapPin, MessageCircle, Phone, Printer,
  Receipt, Search, ShieldCheck, Truck,
} from "lucide-react";
import { getOrder, STATUS_FLOW, STATUS_LABEL, ORDER_STATUS } from "../utils/orders.js";
import { fetchOrderById, LOOKUP_MESSAGES } from "../lib/customerOrdersClient.js";
import { checkPhoneField, phoneBlur } from "../utils/phone.js";
import { isPaystackConfigured, payForExistingOrder } from "../lib/paystackClient.js";
import { useStore } from "../context/StoreContext.jsx";
import { naira } from "../utils/format.js";
import { SITE } from "../config/site.js";

const PAYMENT_LABEL = {
  card: "Card",
  transfer: "Bank Transfer",
  pod: "Pay on Delivery",
  ussd: "USSD",
};

export default function OrderConfirmation() {
  const { id } = useParams();
  // Track Order passes the phone the visitor proved, in router state.
  const passedPhone = useLocation().state?.phone || "";
  const [order, setOrder] = useState(() => getOrder(id));
  const [remoteChecked, setRemoteChecked] = useState(false);
  const { completePaidOrder } = useStore();
  const [paying, setPaying] = useState(false);
  const [payNotice, setPayNotice] = useState("");
  const awaitingPayment = order?.status === ORDER_STATUS.PENDING_PAYMENT;

  // A pending_payment order may have been confirmed by the server since
  // this device cached it (webhook after a closed tab, slow transfer).
  // Re-read it once so we don't offer "Pay now" for a paid order.
  const [pendingRefreshed, setPendingRefreshed] = useState(false);
  useEffect(() => {
    if (!awaitingPayment || pendingRefreshed) return;
    let cancelled = false;
    (async () => {
      const res = await fetchOrderById(id, { phone: order?.contact?.phone });
      if (cancelled) return;
      if (res.order && res.source === "supabase") setOrder(res.order);
      setPendingRefreshed(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, awaitingPayment, pendingRefreshed]);

  async function onPayNow() {
    setPaying(true);
    setPayNotice("");
    try {
      const { outcome } = await payForExistingOrder(order);
      if (outcome === "paid") {
        completePaidOrder(order.id, { clearCart: false, order });
        setOrder(getOrder(order.id) || { ...order, paymentStatus: "paid", status: ORDER_STATUS.CONFIRMED });
      } else if (outcome === "cancelled") {
        setPayNotice("Payment not completed. You can try again, or contact us on WhatsApp to switch to Pay on Delivery.");
      } else {
        setPayNotice("We couldn't confirm your payment yet. If you were charged, this order will be confirmed automatically within a few minutes — please contact support before paying again.");
      }
    } catch (err) {
      setPayNotice(err.message || "Payment could not start. Please try again.");
    } finally {
      setPaying(false);
    }
  }

  useEffect(() => {
    if (order || remoteChecked) return;
    let cancelled = false;
    (async () => {
      // Not on this device: only the phone used for the order (or a
      // signed-in owner's session) can load it. Otherwise ask for it.
      const res = await fetchOrderById(id, { phone: passedPhone });
      if (cancelled) return;
      if (res.order) setOrder(res.order);
      setRemoteChecked(true);
    })();
    return () => { cancelled = true; };
  }, [id, order, remoteChecked, passedPhone]);

  useEffect(() => {
    if (!order || order.syncedAt) return;
    const t = setInterval(() => {
      const next = getOrder(id);
      if (next?.syncedAt) {
        setOrder(next);
        clearInterval(t);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [id, order]);

  if (!order && !remoteChecked) {
    return (
      <main className="wrap">
        <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ink-3)" }}>
          Loading your order…
        </div>
      </main>
    );
  }
  if (!order) return <OrderPhoneGate id={id} onFound={setOrder} />;

  const currentIndex = STATUS_FLOW.indexOf(order.status);
  const created = new Date(order.createdAt);

  /* Build the deep link that lets the customer view the
     receipt without re-entering phone. The Receipt page is
     smart enough to skip the phone challenge if the order is
     already in local storage on the same device. */
  const receiptUrl = `/receipt/${id}?phone=${encodeURIComponent(order.contact.phone)}`;

  return (
    <main className="wrap">
      {/* Confirmation hero */}
      <section className="conf-hero">
        {awaitingPayment ? (
          <>
            <span className="conf-hero__check" style={{ color: "var(--warn)" }}><AlertCircle size={56} /></span>
            <h1>Payment not completed</h1>
            <p>
              {order.contact.name.split(" ")[0]}, we've saved your order but haven't received payment yet.
              It will be confirmed and prepared for delivery once payment goes through.
            </p>
          </>
        ) : (
          <>
            <span className="conf-hero__check"><CircleCheck size={56} /></span>
            <h1>Order Confirmed</h1>
            <p>Thank you, {order.contact.name.split(" ")[0]}! Your order has been received and we'll be in touch shortly.</p>
          </>
        )}
        <div className="conf-hero__id">
          <Receipt size={14} /> Order ID: <b className="mono">{order.id}</b>
          <SyncPill synced={!!order.syncedAt} />
        </div>

        {awaitingPayment && (
          <div className="conf-hero__actions">
            {isPaystackConfigured() ? (
              <button
                type="button"
                className="conf-hero__actionbtn conf-hero__actionbtn--primary"
                onClick={onPayNow}
                disabled={paying}
              >
                <CreditCard size={16} /> {paying ? "Processing secure payment…" : <>Pay now · {naira(order.totals?.grand || 0)}</>}
              </button>
            ) : (
              <a className="conf-hero__actionbtn conf-hero__actionbtn--primary" href={SITE.whatsappLink} target="_blank" rel="noreferrer">
                <MessageCircle size={16} /> Contact us to complete payment
              </a>
            )}
          </div>
        )}
        {payNotice && (
          <p role="alert" style={{ marginTop: 12 }}><small>{payNotice}</small></p>
        )}

        {/* NEW: Receipt actions right below the hero \u2014 most
            visible spot for the primary "get my receipt" action
            since customers land here immediately after paying. */}
        {!awaitingPayment && (
        <div className="conf-hero__actions">
          <Link to={receiptUrl} className="conf-hero__actionbtn conf-hero__actionbtn--primary">
            <Receipt size={16} /> View Official Receipt
          </Link>
          <Link to={receiptUrl} className="conf-hero__actionbtn" target="_blank">
            <Printer size={16} /> Print / Save PDF
          </Link>
        </div>
        )}
      </section>

      {/* Invisible-signup banner */}
      {order.accountCreated && (
        <section className="acct-banner">
          <span className="acct-banner__icon"><BadgeCheck size={28} /></span>
          <div>
            <h2>Your NAVEN account is ready</h2>
            <p>
              We've created your account automatically using your phone number
              <b className="mono"> {order.contact.phone}</b>. To sign in on your next
              visit, <Link to="/signup">sign up</Link> with this phone number to set a
              password — your orders stay linked to it.
            </p>
          </div>
        </section>
      )}

      <div className="conf-grid">
        {/* Tracking timeline */}
        <section className="conf-card">
          <h2><Truck size={18} /> Order Tracking</h2>
          <ol className="track">
            {STATUS_FLOW.map((s, i) => {
              const done = i <= currentIndex;
              const current = i === currentIndex;
              return (
                <li key={s} className={"track__step" + (done ? " track__step--done" : "") + (current ? " track__step--current" : "")}>
                  <span className="track__dot">
                    {done && i < currentIndex ? <Check size={12} /> : i + 1}
                  </span>
                  <div>
                    <b>{STATUS_LABEL[s]}</b>
                    {current && s === ORDER_STATUS.CONFIRMED && (
                      <small>{created.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</small>
                    )}
                    {!current && i > currentIndex && (
                      <small>Pending</small>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="conf-card__note">
            We'll send SMS updates to <b>{order.contact.phone}</b> as your order moves through each stage.
          </p>
        </section>

        {/* Order details */}
        <section className="conf-card">
          <h2><Receipt size={18} /> Order Details</h2>
          <ul className="conf-items">
            {order.items.map((it) => (
              <li key={it.sku}>
                <span className="conf-items__img">
                  {it.image && <img src={it.image} alt="" />}
                  <em>{it.qty}</em>
                </span>
                <span className="conf-items__info">
                  <p>{it.name}</p>
                  <small>SKU <span className="mono">{it.sku}</span></small>
                </span>
                <b>{naira(it.price * it.qty)}</b>
              </li>
            ))}
          </ul>
          <dl className="conf-totals">
            <div><dt>Subtotal</dt><dd>{naira(order.totals.subtotal)}</dd></div>
            {order.totals.discount > 0 && (
              <div className="conf-totals__discount">
                <dt>Discount</dt><dd>\u2212{naira(order.totals.discount)}</dd>
              </div>
            )}
            {order.totals.deliveryFee > 0 && (
              <div><dt>Delivery</dt><dd>{naira(order.totals.deliveryFee)}</dd></div>
            )}
            {order.totals.installationFee > 0 && (
              <div><dt>Installation</dt><dd>{naira(order.totals.installationFee)}</dd></div>
            )}
            <div className="conf-totals__grand">
              <dt>Order Total</dt><dd>{naira(order.totals.grand)}</dd>
            </div>
          </dl>
          <p className="conf-card__note" style={{ marginTop: 12 }}>
            <Link to={receiptUrl}>View full receipt \u2192</Link>
          </p>
        </section>

        {/* Delivery & contact */}
        <section className="conf-card">
          <h2><MapPin size={18} /> Delivery Address</h2>
          <p className="conf-address">
            <b>{order.contact.name}</b><br />
            {order.address.street}<br />
            {order.address.lga}, {order.address.state}<br />
            {order.address.landmark && <><small>{order.address.landmark}</small><br /></>}
            <Phone size={12} /> {order.contact.phone}
            {order.contact.email && <> \u00B7 <Mail size={12} /> {order.contact.email}</>}
          </p>
        </section>

        {/* Payment */}
        <section className="conf-card">
          <h2><ShieldCheck size={18} /> Payment</h2>
          <p className="conf-payment">
            <b>{PAYMENT_LABEL[order.payment?.method || order.payment] || order.payment}</b><br />
            <small>
              {order.paymentStatus === "paid"
                ? "Payment confirmed. Transaction secured."
                : (order.payment?.method || order.payment) === "pod"
                  ? "You'll pay when your order arrives. Have the exact amount ready."
                  : awaitingPayment
                    ? "Payment not completed. Use \"Pay now\" above to finish paying."
                    : "Awaiting payment confirmation. We'll update this order as soon as Paystack confirms it."}
            </small>
          </p>
        </section>
      </div>

      {/* Help + CTAs */}
      <section className="conf-help">
        <a className="conf-help__wa" href={SITE.whatsappLink} target="_blank" rel="noreferrer">
          <MessageCircle size={20} />
          <span>
            <b>Need help with your order?</b>
            <small>Chat with us on WhatsApp — {SITE.whatsapp}</small>
          </span>
          <ChevronRight size={16} />
        </a>
        <Link to="/" className="conf-help__continue">
          Continue Shopping <ChevronRight size={16} />
        </Link>
      </section>
    </main>
  );
}

/**
 * Shown when the order isn't saved on this device (another phone or
 * browser, cleared storage). Same look as the receipt's phone check.
 */
function OrderPhoneGate({ id, onFound }) {
  const [phoneInput, setPhoneInput] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const phoneRes = checkPhoneField(phoneInput);
    if (!phoneRes.ok) {
      setError(phoneRes.error);
      return;
    }
    setLoading(true);
    const res = await fetchOrderById(id, { phone: phoneRes.phone });
    setLoading(false);
    if (res.order) onFound(res.order);
    else setError(res.error || LOOKUP_MESSAGES.notFound);
  }

  return (
    <main className="wrap receipt-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
      </nav>
      <div className="receipt-challenge">
        <span className="receipt-challenge__icon"><Receipt size={28} /></span>
        <h1>Order {id}</h1>
        <p>Enter the phone number used for this order to see its details.</p>

        <form onSubmit={onSubmit}>
          <label className="field">
            <span className="field__label">Phone Number</span>
            <span className="auth-input">
              <input
                type="tel"
                inputMode="tel"
                value={phoneInput}
                onChange={(e) => { setPhoneInput(e.target.value); setError(null); }}
                onBlur={() => phoneBlur(phoneInput, setPhoneInput, setError)}
                maxLength={20}
                placeholder="0803 123 4567"
                autoComplete="tel"
                disabled={loading}
                aria-describedby={error ? "order-gate-error" : undefined}
              />
            </span>
          </label>

          {error && (
            <div className="receipt-challenge__error" id="order-gate-error" role="alert">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading || !phoneInput.trim()}>
            <Search size={16} />
            {loading ? "Looking up…" : "View Order"}
          </button>
        </form>

        <p className="receipt-challenge__help">
          Can't find your order details?{" "}
          <a href={SITE.whatsappLink} target="_blank" rel="noreferrer">Message us on WhatsApp</a>
        </p>
      </div>
    </main>
  );
}

function SyncPill({ synced }) {
  if (synced) {
    return (
      <span
        className="conf-hero__syncpill conf-hero__syncpill--ok"
        title="Order synced to our system"
      >
        <Cloud size={12} /> Confirmed on server
      </span>
    );
  }
  return (
    <span
      className="conf-hero__syncpill conf-hero__syncpill--pending"
      title="Order saved locally — finishing sync in the background"
    >
      <CloudOff size={12} /> Saved locally
    </span>
  );
}