import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle, ChevronRight, Check, Home as HomeIcon, MapPin, MessageCircle,
  Package, Phone, Receipt, Search, Truck,
} from "lucide-react";
import { getOrder, STATUS_FLOW, STATUS_LABEL, ORDER_STATUS } from "../utils/orders.js";
import { naira } from "../utils/format.js";
import { SITE } from "../config/site.js";

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get("id") || "";
  const [input, setInput] = useState(initialId);
  const [submitted, setSubmitted] = useState(initialId);
  const [error, setError] = useState(null);

  useEffect(() => {
    const prev = document.title;
    document.title = `Track Order \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  function onSubmit(e) {
    e.preventDefault();
    setError(null);
    const cleaned = input.trim().toUpperCase();
    if (!cleaned) {
      setError("Enter the order ID from your confirmation SMS or email.");
      return;
    }
    if (!cleaned.startsWith("VLT-")) {
      setError("That doesn\u2019t look like a Voltory order ID. They start with VLT-.");
      return;
    }
    setSubmitted(cleaned);
  }

  const order = submitted ? getOrder(submitted) : null;

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
          <p>Enter your order ID below to see live status, delivery progress and contact options.</p>
        </div>
      </header>

      <section className="track-form">
        <form onSubmit={onSubmit}>
          <label className={"field" + (error ? " has-error" : "")}>
            <span className="field__label">Order ID</span>
            <span className="auth-input">
              <Receipt size={16} />
              <input
                type="text"
                value={input}
                onChange={(e) => { setInput(e.target.value); setError(null); }}
                placeholder="e.g. VLT-202611031245-A8C2"
                autoFocus
                autoComplete="off"
                spellCheck="false"
              />
            </span>
            {error && <span className="field__error">{error}</span>}
            <small className="field__hint">
              Your order ID is in the confirmation SMS we sent after checkout, or in My Account \u2192 My Orders.
            </small>
          </label>
          <button type="submit" className="auth-submit">
            <Search size={16} /> Track Order
          </button>
        </form>
      </section>

      {/* Result */}
      {submitted && !order && (
        <div className="track-noresult">
          <span className="track-noresult__icon"><AlertCircle size={24} /></span>
          <div>
            <h3>We couldn\u2019t find that order</h3>
            <p>
              Double-check the ID for typos \u2014 it should look like <b className="mono">VLT-YYYYMMDDHHmm-XXXX</b>.
              If you\u2019re still stuck, our team can look it up by your phone number.
            </p>
            <div className="track-noresult__actions">
              <a href={SITE.whatsappLink} target="_blank" rel="noreferrer" className="btn-shop">
                <MessageCircle size={14} /> Chat on WhatsApp
              </a>
              <Link to="/contact" className="track-noresult__link">
                Or contact support \u2192
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
          <Link to={`/order/${order.id}`}>View full receipt \u2192</Link>
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
            <small>Chat with our team on WhatsApp \u2014 we\u2019ll find you fast</small>
          </span>
          <ChevronRight size={16} />
        </a>
      </div>
    </section>
  );
}