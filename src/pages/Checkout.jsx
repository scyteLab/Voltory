import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  BadgeCheck, Banknote, ChevronRight, CreditCard, Gift, Home as HomeIcon,
  Info, Lock, MapPin, Phone, Smartphone as PhoneIcon, User, Wrench,
} from "lucide-react";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { useCustomerAuth } from "../context/AuthContext.jsx";
import { useCustomerAddresses } from "../hooks/useCustomerAddresses.js";
import { useCheckoutSettings } from "../hooks/useCheckoutSettings.js";
import AddressPicker from "../components/checkout/AddressPicker.jsx";
import {
  openPaystack, paystackChannelFor, isPaystackConfigured,
  buildPaystackReference, verifyPaystackPayment,
} from "../lib/paystackClient.js";
import { generateOrderId } from "../utils/orders.js";
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
  const { cart, totals, placeOrder, createPendingPaymentOrder, completePaidOrder, requestCall } = useStore();
  const { customer } = useCustomerAuth();
  const { bySku } = useCatalog();
  const { get: getCheckoutSetting } = useCheckoutSettings();
  const navigate = useNavigate();

  const prefillPhone = (customer?.phone || "").startsWith("+234")
    ? "0" + customer.phone.slice(4)
    : (customer?.phone || "");

  const [contact, setContact] = useState({
    name:  customer?.name  || "",
    phone: prefillPhone,
    email: customer?.email || "",
  });

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
  // When Paystack is not configured, only POD is available — default to it.
  const paystackReady = isPaystackConfigured();
  const [payment, setPayment] = useState(paystackReady ? "card" : "pod");
  const [installation, setInstallation] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // Online-payment order awaiting confirmation: { id, grand, reference }.
  // Kept so a retry (or a switch to POD) reuses the same order.
  const [pendingOrder, setPendingOrder] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState("");

  const installFee = installation ? SITE.installationFee : 0;
  // Delivery fee neutralised 2026-10-19 — policy pending CGCL decision.
  // Previous logic used the admin-configurable free_delivery_threshold_ngn setting
  // to decide between FREE and ₦5,500; disabled entirely until CGCL sets real policy.
  const freeDeliveryThreshold = getCheckoutSetting("free_delivery_threshold_ngn");
  const deliveryFee = 0;
  const grand = totals.subtotal - totals.discount + deliveryFee + installFee;

  useEffect(() => {
    if (pickerInitialised) return;
    if (!savedAddresses || savedAddresses.length === 0) return;
    const def = savedAddresses.find((a) => a.is_default) || savedAddresses[0];
    setPickedAddressId(def.id);
    setPickerInitialised(true);
  }, [savedAddresses, pickerInitialised]);

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
    if (picked.name || picked.phone) {
      setContact((c) => ({
        ...c,
        name:  picked.name  || c.name,
        phone: picked.phone || c.phone,
      }));
    }
  }, [pickedAddressId, savedAddresses]);

  if (cart.length === 0) return <Navigate to="/cart" replace />;

  function validate() {
    const e = {};
    if (!contact.name.trim()) e.name = "Full name required";
    if (!/^0[789][01]\d{8}$/.test(contact.phone.replace(/\s/g, ""))) e.phone = "Enter a valid Nigerian phone number";
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) e.email = "Invalid email format";
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
      setTimeout(() => {
        const first = document.querySelector(".has-error input, .has-error select");
        first?.focus();
      }, 50);
      return;
    }
    setSubmitting(true);

    if (customer && !pickedAddressId && saveForNextTime) {
      createSavedAddress({
        label: "",
        name:  contact.name,
        phone: contact.phone,
        state: address.state,
        lga:   address.lga,
        street: address.street,
        landmark: address.landmark,
        is_default: savedAddresses.length === 0,
      }).catch(() => { /* silent; not order-blocking */ });
    }

    const needsPaystack = payment !== "pod" && paystackReady;
    setPaymentNotice("");
    setErrors({});

    if (needsPaystack) {
      // Retry reuses the same pending order, unless the amount changed
      // (e.g. installation toggled) — then it's a different charge and
      // needs a fresh order so the stored total matches what we bill.
      const orderId = pendingOrder && pendingOrder.grand === grand ? pendingOrder.id : generateOrderId();
      const reference = buildPaystackReference(orderId);
      const channel = paystackChannelFor(payment);

      // 1. Create (or refresh) the order in Supabase as 'pending' FIRST.
      const created = await createPendingPaymentOrder({
        contact, address, payment, installation, deliveryFee,
        orderId, paystackRef: reference,
      });
      if (!created.ok) {
        setSubmitting(false);
        setErrors({ payment: "We couldn't start your payment. Please check your connection and try again, or choose Pay on Delivery." });
        return;
      }
      setPendingOrder({ id: orderId, grand, reference });

      // 2. Open Paystack for exactly the stored order total, in kobo.
      const amountKobo = Math.round(created.order.totals.grand) * 100;
      try {
        const result = await openPaystack({
          amountKobo,
          email: contact.email || `${contact.phone.replace(/\D/g, "")}@mynaven.com`,
          reference,
          channels: channel ? [channel] : [],
          metadata: {
            orderId,
            customerName: contact.name,
            customerPhone: contact.phone,
            method: payment,
          },
        });
        if (!result.ok) {
          setSubmitting(false);
          setPaymentNotice("Payment not completed. You can try again or choose Pay on Delivery.");
          return;
        }

        // 3. Popup success is not proof of payment — ask our server,
        //    which asks Paystack and is the only thing that marks paid.
        const { paymentStatus } = await verifyPaystackPayment(result.ref);
        if (paymentStatus === "paid") {
          completePaidOrder(orderId);
          navigate(`/order/${orderId}`);
          return;
        }
        setSubmitting(false);
        setPaymentNotice(
          `We couldn't confirm your payment yet. If you were charged, order ${orderId} will be confirmed automatically within a few minutes — please contact support before paying again.`
        );
      } catch (err) {
        setSubmitting(false);
        // eslint-disable-next-line no-console
        console.error("[checkout] paystack error:", err);
        setErrors({ payment: err.message || "Payment failed. Please try again or choose Pay on Delivery." });
      }
      return;
    }

    // Switching to Pay on Delivery after an unfinished online attempt:
    // check that attempt first (a late transfer may have gone through),
    // otherwise convert that same order to POD instead of duplicating it.
    if (pendingOrder) {
      const { paymentStatus } = await verifyPaystackPayment(pendingOrder.reference);
      if (paymentStatus === "paid") {
        completePaidOrder(pendingOrder.id);
        navigate(`/order/${pendingOrder.id}`);
        return;
      }
    }

    setTimeout(() => {
      const id = placeOrder({
        contact, address, payment, installation,
        deliveryFee,
        orderId: pendingOrder?.id || null,
      });
      navigate(`/order/${id}`);
    }, 400);
  }

  /* Count of free gifts for the summary section */
  const giftCount = cart.filter((i) => i.isGift).length;

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
              <Info size={13} /> Your NAVEN account is created automatically from these details — no signup form needed.
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

            {customer && savedAddresses.length > 0 && (
              <AddressPicker
                addresses={savedAddresses}
                selectedId={pickedAddressId}
                onSelect={(id) => setPickedAddressId(id)}
                onNew={() => {
                  setPickedAddressId(null);
                  setAddress({ state: "Lagos", lga: "", street: "", landmark: "" });
                }}
              />
            )}

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
              {PAYMENT_METHODS
                .filter((m) => paystackReady || m.id === "pod")
                .map((m) => (
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

            {!paystackReady && (
              <p className="ck-card__hint" style={{ marginTop: 12 }}>
                <Info size={13} /> Online payment (Card, Bank Transfer, USSD) is coming soon. For now, please pay on delivery.
              </p>
            )}

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
                /* Gift line — render with FREE styling, no product lookup */
                if (i.isGift) {
                  return (
                    <li key={i.sku} className="ck-summary__gift">
                      <span className="ck-summary__img">
                        {i.giftImage ? (
                          <img src={i.giftImage} alt="" />
                        ) : (
                          <span className="ck-summary__gift-icon"><Gift size={20} /></span>
                        )}
                        <em>{i.qty}</em>
                      </span>
                      <span className="ck-summary__name">
                        <span className="ck-summary__free-label">
                          <Gift size={10} /> FREE
                        </span>
                        {" "}{i.giftDescription}
                      </span>
                      <b>FREE</b>
                    </li>
                  );
                }
                /* Paid product line — lookup product data as before */
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
              {giftCount > 0 && (
                <div className="ck-summary__discount">
                  <dt><Gift size={11} /> Free gift{giftCount === 1 ? "" : "s"} included</dt>
                  <dd>FREE</dd>
                </div>
              )}
              {/* Delivery row hidden pending CGCL policy decision (2026-10-19).
                  Fee calculation preserved for order record; display suppressed. */}
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

            {(paymentNotice || errors.payment) && (
              <p className="ck-card__hint" role="alert" style={{ marginBottom: 12, color: errors.payment ? "var(--err)" : undefined }}>
                <Info size={13} /> {errors.payment || paymentNotice}
              </p>
            )}

            <button type="submit" className="ck-place" disabled={submitting}>
              {submitting
                ? (payment !== "pod" && paystackReady ? "Processing secure payment…" : "Placing Order…")
                : (payment !== "pod" && paystackReady
                    ? <>Pay {naira(grand)}</>
                    : <>Place Order · {naira(grand)}</>)}
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