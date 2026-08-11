import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  BadgeCheck, Banknote, ChevronRight, CreditCard, Home as HomeIcon,
  Info, Lock, MapPin, Phone, Smartphone as PhoneIcon, User, Wrench,
} from "lucide-react";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useCustomerAuth } from "../context/AuthContext.jsx";
import { useCustomerAddresses } from "../hooks/useCustomerAddresses.js";
import AddressPicker from "../components/checkout/AddressPicker.jsx";
import { openPaystack, paystackChannelFor, isPaystackConfigured } from "../lib/paystackClient.js";
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
  const { cart, totals, placeOrder, requestCall } = useStore();
  const { customer } = useCustomerAuth();
  const { bySku } = useCatalog();
  const navigate = useNavigate();

  // Empty cart → bounce back home
  if (cart.length === 0) return <Navigate to="/cart" replace />;

  // Pre-fill from the signed-in customer if any. Phone in DB is
  // +2348..., but the checkout form shows/accepts 08... so we strip
  // the +234 prefix for display.
  const prefillPhone = (customer?.phone || "").startsWith("+234")
    ? "0" + customer.phone.slice(4)
    : (customer?.phone || "");

  const [contact, setContact] = useState({
    name:  customer?.name  || "",
    phone: prefillPhone,
    email: customer?.email || "",
  });

  // Saved addresses (only relevant for signed-in customers). If any
  // saved addresses exist, we default to the customer's default
  // address (or the first one) instead of an empty form. Setting
  // pickedAddressId to null means "the customer wants to enter a
  // new address" and the manual form is shown.
  const { addresses: savedAddresses, create: createSavedAddress } = useCustomerAddresses();
  const [pickedAddressId, setPickedAddressId] = useState(null);
  const [pickerInitialised, setPickerInitialised] = useState(false);
  const [saveForNextTime, setSaveForNextTime] = useState(false);

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

  // First time saved addresses arrive, auto-pick the default one
  // (or the first one if none is marked default). Only runs once
  // per session so we don't override the user's later choice.
  useEffect(() => {
    if (pickerInitialised) return;
    if (!savedAddresses || savedAddresses.length === 0) return;
    const def = savedAddresses.find((a) => a.is_default) || savedAddresses[0];
    setPickedAddressId(def.id);
    setPickerInitialised(true);
  }, [savedAddresses, pickerInitialised]);

  // Whenever a saved address is picked, mirror its fields into the
  // manual `address` state so all downstream code (validate, order
  // save) keeps working unchanged.
  useEffect(() => {
    if (!pickedAddressId) return;
    const picked = savedAddresses.find((a) => a.id === pickedAddressId);
    if (!picked) return;
    setAddress({
      state:    picked.state    || "Lagos",
      lga:      picked.lga      || "",
      street:   picked.street   || "",
      landmark: picked.landmark || "",
    });
    // Also mirror name/phone into contact if the saved address has
    // recipient info \u2014 useful for gift deliveries
    if (picked.name || picked.phone) {
      setContact((c) => ({
        ...c,
        name:  picked.name  || c.name,
        phone: picked.phone || c.phone,
      }));
    }
  }, [pickedAddressId, savedAddresses]);

  function validate() {
    const e = {};
    if (!contact.name.trim()) e.name = "Full name required";
    if (!/^0[789][01]\d{8}$/.test(contact.phone.replace(/\s/g, ""))) e.phone = "Enter a valid Nigerian phone number";
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) e.email = "Invalid email format";
    // Only validate address fields when the customer is typing a new
    // address. If they've picked a saved one, its fields were already
    // validated when it was created.
    if (!pickedAddressId) {
      if (!address.lga.trim()) e.lga = "LGA / City required";
      if (!address.street.trim()) e.street = "Street address required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev) {
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

    // If the customer typed a new address AND ticked "save for next
    // time", fire an async save to customer_addresses. We don't wait
    // for it \u2014 the order should proceed even if the save fails
    // (they can always add it manually on /account/addresses later).
    if (customer && !pickedAddressId && saveForNextTime) {
      createSavedAddress({
        label: "",
        name:  contact.name,
        phone: contact.phone,
        state: address.state,
        lga:   address.lga,
        street: address.street,
        landmark: address.landmark,
        // First-ever save becomes default automatically
        is_default: savedAddresses.length === 0,
      }).catch(() => { /* silent; not order-blocking */ });
    }

    // Compute the amount to charge (includes installation fee)
    const chargeAmount = grand;

    // Route based on payment method:
    //   \u00B7 pod           \u2192 no Paystack, order goes through as unpaid
    //   \u00B7 card/transfer/ussd \u2192 Paystack Inline modal, wait for callback
    //
    // If Paystack isn't configured (no VITE_PAYSTACK_PUBLIC_KEY),
    // we fall back to the pre-Paystack behaviour: order goes through
    // as unpaid so we don't block launches when payment infra isn't
    // wired yet.

    const needsPaystack = payment !== "pod" && isPaystackConfigured();

    if (needsPaystack) {
      const orderIdForRef = "PAY-" + Date.now().toString(36).toUpperCase();
      const channel = paystackChannelFor(payment);
      try {
        const result = await openPaystack({
          amount: chargeAmount,
          email: contact.email || `${contact.phone.replace(/\D/g, "")}@voltory.ng`,
          reference: orderIdForRef,
          channels: channel ? [channel] : [],
          metadata: {
            customerName: contact.name,
            customerPhone: contact.phone,
            method: payment,
          },
        });
        if (!result.ok) {
          // Cancelled or failed \u2014 stay on checkout
          setSubmitting(false);
          if (!result.cancelled) {
            setErrors({ payment: "Payment could not be completed. Please try again." });
          }
          return;
        }
        // Payment succeeded \u2014 create the order with paid status
        const id = placeOrder({
          contact, address, payment, installation,
          paystackRef: result.ref,
          paymentStatus: "paid",
        });
        navigate(`/order/${id}`);
      } catch (err) {
        setSubmitting(false);
        // eslint-disable-next-line no-console
        console.error("[checkout] paystack error:", err);
        setErrors({ payment: err.message || "Payment failed. Please try again or choose Pay on Delivery." });
      }
      return;
    }

    // Non-Paystack path (pay on delivery, or Paystack not configured)
    setTimeout(() => {
      const id = placeOrder({
        contact, address, payment, installation,
        paymentStatus: "unpaid",
      });
      navigate(`/order/${id}`);
    }, 400);
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

            {/* Saved addresses picker \u2014 only shown for signed-in
                customers who have at least one saved address. */}
            {customer && savedAddresses.length > 0 && (
              <AddressPicker
                addresses={savedAddresses}
                selectedId={pickedAddressId}
                onSelect={(id) => setPickedAddressId(id)}
                onNew={() => {
                  setPickedAddressId(null);
                  // Clear the form so the customer starts fresh
                  setAddress({ state: "Lagos", lga: "", street: "", landmark: "" });
                }}
              />
            )}

            {/* Manual form \u2014 shown when no saved address is picked
                (guest checkout, no saved addresses, or "new" toggle) */}
            {!pickedAddressId && (
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
            )}

            {/* Save-for-next-time \u2014 only when signed in AND typing a
                new address. Guests don't have anywhere to save to. */}
            {customer && !pickedAddressId && (
              <label className="ck-savefornext">
                <input
                  type="checkbox"
                  checked={saveForNextTime}
                  onChange={(e) => setSaveForNextTime(e.target.checked)}
                />
                <span>Save this address for next time</span>
              </label>
            )}

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
              {submitting
                ? (payment !== "pod" && isPaystackConfigured() ? "Opening secure payment\u2026" : "Placing Order\u2026")
                : (payment !== "pod" && isPaystackConfigured()
                    ? <>Pay {naira(grand)}</>
                    : <>Place Order \u00B7 {naira(grand)}</>)}
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