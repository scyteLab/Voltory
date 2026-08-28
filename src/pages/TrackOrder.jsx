import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle, ChevronRight, Check, Home as HomeIcon, MapPin, MessageCircle,
  Package, Phone, Receipt, Search, Truck,
} from "lucide-react";
import { STATUS_FLOW, STATUS_LABEL, ORDER_STATUS } from "../utils/orders.js";
import { fetchOrderByIdAndPhone } from "../lib/customerOrdersClient.js";
import { naira } from "../utils/format.js";
import { SITE } from "../config/site.js";

/**
 * TrackOrder — public /track-order page
 *
 * Guest lookup by (order id + phone). Both required. Rate-limited
 * server-side. Preserves the existing visual design: breadcrumb,
 * support-page shell, step tracker, WhatsApp fallback CTAs.
 *
 * URL query params:
 *   ?id=VLT-...     — prefills order id field
 *   ?phone=0803...  — prefills phone field
 *   (both present)  — auto-submits on load (deep link from email/SMS)
 */
export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const initialId    = searchParams.get("id") || "";
  const initialPhone = searchParams.get("phone") || "";

  const [idInput, setIdInput]       = useState(initialId);
  const [phoneInput, setPhoneInput] = useState(initialPhone);
  const [submitted, setSubmitted]   = useState(null);
  const [order, setOrder]           = useState(null);
  const [looking, setLooking]       = useState(false);
  const [error, setError]           = useState(null);

  useEffect(() => {
    const prev = document.title;
    document.title = `Track Order — ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  /* Auto-submit if both params were in the URL */
  useEffect(() => {
    if (initialId && initialPhone) {
      doLookup(initialId, initialPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doLookup(id, phone) {
    const cleanedId = id.trim().toUpperCase();
    setSubmitted({ id: cleanedId, phone: phone.trim() });
    setOrder(null);
    setLooking(true);
    setError(null);

    const res = await fetchOrderByIdAndPhone({ orderId: cleanedId, phone: phone.trim() });
    setLooking(false);

    if (res.order) {
      setOrder(res.order);
    } else {
      setError(res.error || "We couldn’t find that order.");
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    setError(null);

    const cleanedId = idInput.trim().toUpperCase();
    if (!cleanedId) {
      setError("Enter the order ID from your confirmation SMS or email.");
      return;
    }
    if (!cleanedId.startsWith("VLT-")) {
      setError("That doesn’t look like a NAVEN order ID. They start with VLT-.");
      return;
    }
    if (!phoneInput.trim()) {
      setError("Enter the phone number you used when placing the order.");
      return;
    }

    doLookup(cleanedId, phoneInput);
  }

  return (
    <main className="wrap support-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Track Order</span>
      </nav>

      <header className="support-head">
        <span className="support-head__icon"><Truck size={26} /></span>
        <div>
          <h1>Track Your Order</h1>
          <p>Enter your order ID and phone number to see live status, delivery progress and contact options.</p>
        </div>
      </header>

      <section className="track-form">
        <form onSubmit={onSubmit}>
          <label className={"field" + (error && !idInput.startsWith("VLT-") ? " has-error" : "")}>
            <span className="field__label">Order ID</span>
            <span className="auth-input">
              <Receipt size={16} />
              <input
                type="text"
                value={idInput}
                onChange={(e) => { setIdInput(e.target.value); setError(null); }}
                placeholder="e.g. VLT-202611031245-A8C2"
                autoComplete="off"
                spellCheck="false"
                disabled={looking}
              />
            </span>
            <small className="field__hint">
              Your order ID is in the confirmation SMS we sent after checkout, or in My Account → My Orders.
            </small>
          </label>

          <label className="field">
            <span className="field__label">Phone Number</span>
            <span className="auth-input">
              <Phone size={16} />
              <input
                type="tel"
                inputMode="numeric"
                value={phoneInput}
                onChange={(e) => { setPhoneInput(e.target.value); setError(null); }}
                placeholder="0803 123 4567"
                autoComplete="tel"
                disabled={looking}
              />
            </span>
            <small className="field__hint">
              The phone number used when placing the order.
            </small>
          </label>

          {error && (
            <div className="field has-error">
              <span className="field__error">{error}</span>
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={looking || !idInput.trim() || !phoneInput.trim()}>
            <Search size={16} /> {looking ? "Looking up…" : "Track Order"}
          </button>
        </form>
      </section>

      {/* Result states */}
      {submitted && looking && !order && (
        <div className="track-noresult" style={{ borderColor: "var(--line)" }}>
          <span className="track-noresult__icon"><Search size={24} /></span>
          <div>
            <h3>Looking up your order…</h3>
            <p>One moment.</p>
          </div>
        </div>
      )}

      {submitted && !looking && !order && error && (
        <div className="track-noresult">
          <span className="track-noresult__icon"><AlertCircle size={24} /></span>
          <div>
            <h3>We couldn’t find that order</h3>
            <p>
              Double-check both the ID (like <b className="mono">VLT-YYYYMMDDHHmm-XXXX</b>) and the phone number
              you used at checkout. If you’re still stuck, our team can help.
            </p>
            <div className="track-noresult__actions">
              <a href={SITE.whatsappLink} target="_blank" rel="noreferrer" className="btn-shop">
                <MessageCircle size={14} /> Chat on WhatsApp
              </a>
              <Link to="/contact" className="track-noresult__link">
                Or contact support →
              </Link>
            </div>
          </div>
        </div>
      )}

      {order && <OrderTrack order={order} />}
    </main>
  );
}

function OrderTrack({ order }) {
  const currentIndex = STATUS_FLOW.indexOf(order.status);

  return (
    <section className="track-result">
      <div className="track-result__head">
        <div>
          <span className="track-result__id">
            <Receipt size={13} /> <b className="mono">{order.id}</b>
          </span>
          <h2>{order.status === ORDER_STATUS.DELIVERED ? "Delivered" : "Order in progress"}</h2>
          <p>
            Placed on {new Date(order.createdAt).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short" })}
          </p>
        </div>
        <div className="track-result__total">
          <span>Order total</span>
          <b>{naira(order.totals.grand)}</b>
          <Link to={`/order/${order.id}`}>View full receipt →</Link>
        </div>
      </div>

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
                  <small>{new Date(order.createdAt).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</small>
                )}
                {!current && i > currentIndex && <small>Pending</small>}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="track-summary">
        <div className="track-summary__col">
          <h4><Package size={14} /> Items</h4>
          <ul>
            {order.items.slice(0, 3).map((it) => (
              <li key={it.sku}>
                <span className="track-summary__img">
                  {it.image && <img src={it.image} alt="" />}
                  <em>{it.qty}</em>
                </span>
                <span>{it.name}</span>
              </li>
            ))}
            {order.items.length > 3 && (
              <li className="track-summary__more">+ {order.items.length - 3} more item{order.items.length - 3 === 1 ? "" : "s"}</li>
            )}
          </ul>
        </div>
        <div className="track-summary__col">
          <h4><MapPin size={14} /> Delivery to</h4>
          <p>
            <b>{order.contact.name}</b><br />
            {order.address.street}<br />
            {order.address.lga}, {order.address.state}
          </p>
          <small><Phone size={11} /> <span className="mono">{order.contact.phone}</span></small>
        </div>
      </div>

      <div className="track-help">
        <a href={SITE.whatsappLink} target="_blank" rel="noreferrer" className="track-help__wa">
          <MessageCircle size={18} />
          <span>
            <b>Need help with this order?</b>
            <small>Chat with our team on WhatsApp — we’ll find you fast</small>
          </span>
          <ChevronRight size={16} />
        </a>
      </div>
    </section>
  );
}