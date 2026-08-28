import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  BadgeCheck, Check, ChevronRight, CircleCheck, Cloud, CloudOff,
  Home as HomeIcon, Mail, MapPin, MessageCircle, Phone, Printer,
  Receipt, ShieldCheck, Truck,
} from "lucide-react";
import { getOrder, STATUS_FLOW, STATUS_LABEL, ORDER_STATUS } from "../utils/orders.js";
import { fetchOrderById } from "../lib/customerOrdersClient.js";
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
  const [order, setOrder] = useState(() => getOrder(id));
  const [remoteChecked, setRemoteChecked] = useState(false);

  useEffect(() => {
    if (order || remoteChecked) return;
    let cancelled = false;
    (async () => {
      const res = await fetchOrderById(id);
      if (cancelled) return;
      if (res.order) setOrder(res.order);
      setRemoteChecked(true);
    })();
    return () => { cancelled = true; };
  }, [id, order, remoteChecked]);

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
          Loading your order\u2026
        </div>
      </main>
    );
  }
  if (!order) return <Navigate to="/" replace />;

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
        <span className="conf-hero__check"><CircleCheck size={56} /></span>
        <h1>Order Confirmed</h1>
        <p>Thank you, {order.contact.name.split(" ")[0]}! Your order has been received and we'll be in touch shortly.</p>
        <div className="conf-hero__id">
          <Receipt size={14} /> Order ID: <b className="mono">{order.id}</b>
          <SyncPill synced={!!order.syncedAt} />
        </div>

        {/* NEW: Receipt actions right below the hero \u2014 most
            visible spot for the primary "get my receipt" action
            since customers land here immediately after paying. */}
        <div className="conf-hero__actions">
          <Link to={receiptUrl} className="conf-hero__actionbtn conf-hero__actionbtn--primary">
            <Receipt size={16} /> View Official Receipt
          </Link>
          <Link to={receiptUrl} className="conf-hero__actionbtn" target="_blank">
            <Printer size={16} /> Print / Save PDF
          </Link>
        </div>
      </section>

      {/* Invisible-signup banner */}
      {order.accountCreated && (
        <section className="acct-banner">
          <span className="acct-banner__icon"><BadgeCheck size={28} /></span>
          <div>
            <h2>Your NAVEN account is ready</h2>
            <p>
              We've created your account automatically using your phone number
              <b className="mono"> {order.contact.phone}</b>. Next time you shop,
              just enter your phone \u2014 we'll handle the rest. No password needed.
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
            <div><dt>Delivery</dt><dd>{order.totals.deliveryFee === 0 ? "FREE" : naira(order.totals.deliveryFee)}</dd></div>
            {order.totals.installationFee > 0 && (
              <div><dt>Installation</dt><dd>{naira(order.totals.installationFee)}</dd></div>
            )}
            <div className="conf-totals__grand">
              <dt>Total Paid</dt><dd>{naira(order.totals.grand)}</dd>
            </div>
          </dl>
          <p className="conf-card__note" style={{ marginTop: 12 }}>
            <Link to={receiptUrl}>View full receipt with VAT breakdown \u2192</Link>
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
              {(order.payment?.method || order.payment) === "pod"
                ? "You'll pay when your order arrives. Have the exact amount ready."
                : "Payment confirmed. Transaction secured."}
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
            <small>Chat with us on WhatsApp \u2014 {SITE.whatsapp}</small>
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
      title="Order saved locally \u2014 finishing sync in the background"
    >
      <CloudOff size={12} /> Saved locally
    </span>
  );
}