import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  BadgeCheck, Banknote, ChevronRight, CreditCard, Home as HomeIcon,
  Info, Lock, MapPin, Phone, Smartphone as PhoneIcon, User, Wrench,
} from "lucide-react";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { naira } from "../utils/format.js";
import { SITE } from "../config/site.js";

const NIGERIAN_STATES = [
  "Lagos", "Abuja FCT", "Rivers", "Oyo", "Kano", "Kaduna", "Ogun",
  "Anambra", "Enugu", "Delta", "Edo", "Cross River", "Akwa Ibom",
  "Plateau", "Bayelsa", "Imo", "Ondo", "Osun", "Other",
];

const PAYMENT_METHODS = [
  { id: "card", icon: CreditCard, label: "Pay with Card", note: "Visa, Mastercard, Verve — secured by Paystack" },
  { id: "transfer", icon: Banknote, label: "Bank Transfer", note: "Transfer to a one-time account number" },
  { id: "pod", icon: HomeIcon, label: "Pay on Delivery", note: "OTP-verified · Lagos zones only" },
  { id: "ussd", icon: PhoneIcon, label: "USSD", note: "Dial a code from your bank app" },
];

export default function Checkout() {
  const { cart, totals, account, placeOrder, requestCall } = useStore();
  const { bySku } = useCatalog();
  const navigate = useNavigate();

  // Empty cart → bounce back home
  if (cart.length === 0) return <Navigate to="/cart" replace />;

  const [contact, setContact] = useState({
    name: account?.name || "",
    phone: account?.phone || "",
    email: account?.email || "",
  });
  const [address, setAddress] = useState({
    state: "Lagos",
    lga: "",
    street: "",
    landmark: "",
  });
  const [payment, setPayment] = useState("card");
  const [installation, setInstallation] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const installFee = installation ? SITE.installationFee : 0;
  const grand = totals.grand + installFee;

  function validate() {
    const e = {};
    if (!contact.name.trim()) e.name = "Full name required";
    if (!/^0[789][01]\d{8}$/.test(contact.phone.replace(/\s/g, ""))) e.phone = "Enter a valid Nigerian phone number";
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) e.email = "Invalid email format";
    if (!address.lga.trim()) e.lga = "LGA / City required";
    if (!address.street.trim()) e.street = "Street address required";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function onSubmit(ev) {
    ev.preventDefault();
    if (!validate()) {
      // Scroll to first error field
      setTimeout(() => {
        const first = document.querySelector(".has-error input, .has-error select");
        first?.focus();
      }, 50);
      return;
    }
    setSubmitting(true);
    // Simulate payment processing — replace with Paystack when backend lands
    setTimeout(() => {
      const id = placeOrder({ contact, address, payment, installation });
      navigate(`/order/${id}`);
    }, 600);
  }

  return (
    <main className="wrap">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <Link to="/cart">Cart</Link>
        <ChevronRight size={12} />
        <span>Checkout</span>
      </nav>

      <h1 className="checkout__title">Checkout</h1>

      <form className="checkout" onSubmit={onSubmit} noValidate>
        <div className="checkout__main">

          {/* SECTION 1 — Contact */}
          <section className="ck-card">
            <h2><span className="ck-card__step">1</span><User size={18} /> Contact Information</h2>
            <p className="ck-card__hint">
              <Info size={13} /> Your Voltory account is created automatically from these details — no signup form needed.
            </p>

            <div className="ck-grid">
              <Field label="Full Name" error={errors.name}>
                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  placeholder="e.g. Chidi Okeke"
                  autoComplete="name"
                />
              </Field>
              <Field label="Phone Number" error={errors.phone} note="Becomes your account ID">
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  placeholder="0803 123 4567"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </Field>
              <Field label="Email Address (optional)" error={errors.email} full>
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </Field>
            </div>
          </section>

          {/* SECTION 2 — Delivery Address */}
          <section className="ck-card">
            <h2><span className="ck-card__step">2</span><MapPin size={18} /> Delivery Address</h2>

            <div className="ck-grid">
              <Field label="State" error={errors.state}>
                <select
                  value={address.state}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  autoComplete="address-level1"
                >
                  {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="LGA / City" error={errors.lga}>
                <input
                  type="text"
                  value={address.lga}
                  onChange={(e) => setAddress({ ...address, lga: e.target.value })}
                  placeholder="e.g. Lekki, Ikeja, Wuse"
                  autoComplete="address-level2"
                />
              </Field>
              <Field label="Street Address" error={errors.street} full>
                <input
                  type="text"
                  value={address.street}
                  onChange={(e) => setAddress({ ...address, street: e.target.value })}
                  placeholder="House number, street, area"
                  autoComplete="street-address"
                />
              </Field>
              <Field label="Landmark (optional)" full>
                <input
                  type="text"
                  value={address.landmark}
                  onChange={(e) => setAddress({ ...address, landmark: e.target.value })}
                  placeholder="e.g. Behind GTBank Lekki Phase 1"
                />
              </Field>
            </div>

            {/* Installation toggle */}
            <label className="ck-install">
              <input
                type="checkbox"
                checked={installation}
                onChange={(e) => setInstallation(e.target.checked)}
              />
              <Wrench size={18} />
              <span>
                <b>Add Professional Installation — {naira(SITE.installationFee)}</b>
                <small>Certified technician installs ACs, TVs and washing machines after delivery.</small>
              </span>
            </label>
          </section>

          {/* SECTION 3 — Payment */}
          <section className="ck-card">
            <h2><span className="ck-card__step">3</span><CreditCard size={18} /> Payment Method</h2>

            <div className="ck-pay">
              {PAYMENT_METHODS.map((m) => (
                <label key={m.id} className={"ck-pay__opt" + (payment === m.id ? " ck-pay__opt--on" : "")}>
                  <input
                    type="radio"
                    name="payment"
                    value={m.id}
                    checked={payment === m.id}
                    onChange={() => setPayment(m.id)}
                  />
                  <span className="ck-pay__icon"><m.icon size={20} /></span>
                  <span>
                    <b>{m.label}</b>
                    <small>{m.note}</small>
                  </span>
                </label>
              ))}
            </div>

            <p className="ck-card__hint" style={{ marginTop: 16 }}>
              <Lock size={13} /> All transactions are encrypted. We never store your card details.
            </p>
          </section>
        </div>

        {/* Sticky order summary */}
        <aside className="checkout__summary">
          <div className="ck-summary">
            <h2>Order Summary</h2>
            <ul className="ck-summary__items">
              {cart.map((i) => {
                const p = bySku(i.sku);
                if (!p) return null;
                return (
                  <li key={i.sku}>
                    <span className="ck-summary__img">
                      {p.image && <img src={p.image} alt="" />}
                      <em>{i.qty}</em>
                    </span>
                    <span className="ck-summary__name">{p.name}</span>
                    <b>{naira(p.price * i.qty)}</b>
                  </li>
                );
              })}
            </ul>

            <dl className="ck-summary__totals">
              <div>
                <dt>Subtotal</dt>
                <dd>{naira(totals.subtotal)}</dd>
              </div>
              {totals.discount > 0 && (
                <div className="ck-summary__discount">
                  <dt>Discount</dt>
                  <dd>−{naira(totals.discount)}</dd>
                </div>
              )}
              <div>
                <dt>Delivery</dt>
                <dd>{totals.deliveryFee === 0 ? "FREE" : naira(totals.deliveryFee)}</dd>
              </div>
              {installation && (
                <div>
                  <dt>Installation</dt>
                  <dd>{naira(SITE.installationFee)}</dd>
                </div>
              )}
              <div className="ck-summary__grand">
                <dt>Total</dt>
                <dd>{naira(grand)}</dd>
              </div>
            </dl>

            <button type="submit" className="ck-place" disabled={submitting}>
              {submitting ? "Placing Order..." : <>Place Order · {naira(grand)}</>}
            </button>

            <p className="ck-summary__secure">
              <BadgeCheck size={13} /> 100% Original ·{" "}
              <a
                href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                onClick={(e) => { e.preventDefault(); requestCall(SITE.phone); }}
              >
                <Phone size={13} /> Support {SITE.phone}
              </a>
            </p>
          </div>
        </aside>
      </form>
    </main>
  );
}

/** Field — handles label, error display, and the half/full layout switch. */
function Field({ label, error, note, full, children }) {
  return (
    <label className={"field" + (full ? " field--full" : "") + (error ? " has-error" : "")}>
      <span className="field__label">
        {label}
        {note && <small className="field__note">— {note}</small>}
      </span>
      {children}
      {error && <span className="field__error">{error}</span>}
    </label>
  );
}