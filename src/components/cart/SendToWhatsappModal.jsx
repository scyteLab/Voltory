import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle, Check, CheckCircle2, Copy, ExternalLink, Loader2, Lock, MessageCircle, X,
} from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import { naira } from "../../utils/format.js";
import { buildQuoteItems, generateQuoteRef, saveQuote } from "../../lib/whatsappQuotesClient.js";
import { formatNgPhone, toIntlNgPhone, validateNgPhone } from "../../utils/phone.js";
import { cartMessage, whatsappUrl } from "../../utils/whatsappMessage.js";

/**
 * SendToWhatsappModal
 *
 * Opened from "Send Cart to WhatsApp" on the cart page. Collects
 * name + phone (+ optional email), then on "Continue on WhatsApp":
 *
 *   1. Opens WhatsApp with the cart message — synchronously, inside
 *      the click, before any await, so popup blockers allow it
 *      (mobile: same tab hand-off; desktop: new tab).
 *   2. Saves the quote (whatsapp_quotes + items) in the background
 *      with the same reference. A failed save is only logged.
 *   3. Shows a success state with the reference, a fallback link and
 *      "Copy message". The cart is NOT cleared.
 *
 * Nothing goes to form_submissions / contact_messages.
 *
 * Rendered through a portal on document.body with its own backdrop,
 * focus trap, Escape / backdrop close and body-scroll lock. Focus
 * returns to whatever opened it (the cart page button).
 */

const STORAGE_KEY = "naven:wa-contact";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function readSavedContact() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {};
  } catch {
    return {};
  }
}

function saveContact(contact) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contact));
  } catch { /* private mode / storage full: prefill is a nice-to-have */ }
}

/** "08031234567" → "803 123 4567" (what goes after the fixed +234). */
function localDisplay(input) {
  const res = validateNgPhone(input);
  return res.ok ? formatNgPhone(res.phone).slice(1) : String(input ?? "");
}

const validators = {
  name: (v) => (v.trim().length >= 2 ? null : "Please enter your full name."),
  phone: (v) => {
    if (!v.trim()) return "Please enter your WhatsApp number.";
    return validateNgPhone(v).ok ? null : "Enter a Nigerian mobile number, e.g. 803 123 4567.";
  },
  email: (v) => (!v.trim() || EMAIL_RE.test(v.trim()) ? null : "That email doesn't look right. Check it or leave it blank."),
};
const FIELD_ORDER = ["name", "phone", "email"];

/** Mobile browsers hand wa.me to the app; a new tab there just adds a blank page. */
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)); // iPadOS
}

export default function SendToWhatsappModal({ onClose }) {
  const { customer } = useCustomerAuth();
  const { cart } = useStore();
  const { bySku } = useCatalog();
  const uid = useId();
  const ids = {
    title: `${uid}-title`,
    name: `${uid}-name`, phone: `${uid}-phone`, email: `${uid}-email`,
  };

  const [values, setValues] = useState(() => {
    const saved = readSavedContact();
    const phone = customer?.phone || saved.phone || "";
    return {
      name:  customer?.name  || saved.name  || "",
      phone: phone ? localDisplay(phone) : "",
      email: customer?.email || saved.email || "",
    };
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [sent, setSent] = useState(null); // { ref, url, message }
  const [copied, setCopied] = useState(null); // 'ref' | 'message'

  const panelRef = useRef(null);
  const fieldRefs = { name: useRef(null), phone: useRef(null), email: useRef(null) };
  const doneRef = useRef(null);

  /* Cart lines shown in the summary and sent in the message */
  const lines = useMemo(() => cart
    .filter((l) => !l.isGift)
    .map((l) => {
      const p = bySku(l.sku);
      return p ? { sku: p.sku, name: p.name, qty: l.qty, unitPrice: p.price, lineTotal: p.price * l.qty } : null;
    })
    .filter(Boolean), [cart, bySku]);
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  /* ---- open / close plumbing ---- */

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const busyRef = useRef(false);
  busyRef.current = submitting;

  useEffect(() => {
    const opener = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Autofocus: the first empty field, else name.
    const t = setTimeout(() => {
      const first = FIELD_ORDER.find((k) => k !== "email" && !fieldRefs[k].current?.value) || "name";
      fieldRefs[first].current?.focus();
    }, 30);

    function onKey(e) {
      if (e.key === "Escape" && !busyRef.current) {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(panelRef.current.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sent) doneRef.current?.focus();
  }, [sent]);

  const requestClose = () => { if (!submitting) onClose(); };

  /* ---- fields ---- */

  function setField(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
    // Once a field has shown an error, re-check it as the customer fixes it.
    if (errors[key]) setErrors((er) => ({ ...er, [key]: validators[key](value) }));
    setFormError(null);
  }

  function blurField(key) {
    let value = values[key];
    if (key === "phone" && validateNgPhone(value).ok) {
      value = localDisplay(value);
      setValues((v) => ({ ...v, phone: value }));
    }
    if (value.trim() || errors[key]) setErrors((er) => ({ ...er, [key]: validators[key](value) }));
  }

  /* ---- submit ---- */

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const nextErrors = Object.fromEntries(FIELD_ORDER.map((k) => [k, validators[k](values[k])]));
    setErrors(nextErrors);
    const firstInvalid = FIELD_ORDER.find((k) => nextErrors[k]);
    if (firstInvalid) {
      fieldRefs[firstInvalid].current?.focus();
      return;
    }
    if (!lines.length) {
      setFormError("Your cart is still loading. Please try again in a moment.");
      return;
    }

    setSubmitting(true);
    const phoneRes = validateNgPhone(values.phone);
    const contact = { name: values.name.trim(), phone: phoneRes.phone, email: values.email.trim() };
    const ref = generateQuoteRef();
    const message = cartMessage({
      items: lines,
      gifts: cart
        .filter((l) => l.isGift)
        .map((l) => ({ name: l.giftDescription || l.offerTitle || "Promotional gift", giftFor: l.giftFor })),
      total,
      name: contact.name,
      phone: toIntlNgPhone(phoneRes.phone),
      email: contact.email,
      quoteRef: ref,
    });
    const url = whatsappUrl(message);

    // 1. WhatsApp first, synchronously — no await before this line.
    try {
      if (isMobileDevice()) window.location.href = url;
      else window.open(url, "_blank", "noopener");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[SendToWhatsapp] couldn't open WhatsApp automatically:", err);
    }

    // 2. Then remember the details and save the quote in the background.
    saveContact({ name: contact.name, phone: phoneRes.phone, email: contact.email });
    saveQuote({
      quoteId: ref,
      items: buildQuoteItems(cart, bySku, ref),
      subtotal: total,
      customer,
      contact,
    });

    // 3. Success state (with a manual link in case nothing opened).
    setSent({ ref, url, message });
    setSubmitting(false);
  }

  async function copy(text, what) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
    } catch {
      setFormError("Couldn't copy automatically. Please select and copy it instead.");
    }
  }

  /* ---- render ---- */

  const fieldProps = (key) => ({
    id: ids[key],
    ref: fieldRefs[key],
    value: values[key],
    onChange: (e) => setField(key, e.target.value),
    onBlur: () => blurField(key),
    disabled: submitting,
    "aria-invalid": errors[key] ? "true" : undefined,
    "aria-describedby": errors[key]
      ? `${ids[key]}-err`
      : key === "phone" ? `${ids.phone}-help` : undefined,
  });

  const fieldError = (key) => errors[key] && (
    <p className="swa-field__err" id={`${ids[key]}-err`}>
      <AlertCircle size={14} aria-hidden="true" /> {errors[key]}
    </p>
  );

  return createPortal(
    <div className="swa-layer">
      <div className="swa-backdrop" onClick={requestClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="swa-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
      >
        <header className="swa-head">
          <span className="swa-head__icon" aria-hidden="true"><MessageCircle size={20} /></span>
          <h2 id={ids.title}>{sent ? "WhatsApp is opening…" : "Send your cart to WhatsApp"}</h2>
          <button type="button" className="swa-x" onClick={requestClose} aria-label="Close" disabled={submitting}>
            <X size={20} />
          </button>
        </header>

        {sent ? (
          <div className="swa-body swa-done">
            <CheckCircle2 size={44} className="swa-done__icon" aria-hidden="true" />
            <p className="swa-done__lead">
              Send the message in WhatsApp and our sales team will take it from there.
            </p>
            <div className="swa-ref">
              <span>Your reference</span>
              <b>{sent.ref}</b>
              <button type="button" className="swa-ref__copy" onClick={() => copy(sent.ref, "ref")}>
                {copied === "ref" ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
            <p className="swa-done__fallback">
              Didn&apos;t open?{" "}
              <a href={sent.url} target="_blank" rel="noopener noreferrer">
                Tap here to open WhatsApp <ExternalLink size={13} aria-hidden="true" />
              </a>
            </p>
            {formError && <p className="swa-form-err" role="alert">{formError}</p>}
            <div className="swa-actions">
              <button type="button" className="swa-btn swa-btn--ghost" onClick={() => copy(sent.message, "message")}>
                {copied === "message" ? <><Check size={16} /> Message copied</> : <><Copy size={16} /> Copy message</>}
              </button>
              <button type="button" ref={doneRef} className="swa-btn swa-btn--wa" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="swa-body" onSubmit={handleSubmit} noValidate>
            <p className="swa-intro">
              Share your details and we&apos;ll continue on WhatsApp to confirm stock, pricing and delivery.
            </p>

            <div className="swa-grid">
              <div className="swa-field">
                <label htmlFor={ids.name}>Full name <span className="swa-req" aria-hidden="true">*</span></label>
                <input
                  {...fieldProps("name")}
                  type="text"
                  autoComplete="name"
                  placeholder="First and last name"
                  maxLength={80}
                  required
                />
                {fieldError("name")}
              </div>

              <div className="swa-field">
                <label htmlFor={ids.phone}>WhatsApp number <span className="swa-req" aria-hidden="true">*</span></label>
                <div className={"swa-phone" + (errors.phone ? " swa-phone--err" : "")}>
                  <span className="swa-phone__cc" aria-hidden="true">+234</span>
                  <input
                    {...fieldProps("phone")}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="803 123 4567"
                    maxLength={20}
                    required
                  />
                </div>
                {errors.phone
                  ? fieldError("phone")
                  : <p className="swa-field__help" id={`${ids.phone}-help`}>We&apos;ll message you on this number.</p>}
              </div>

              <div className="swa-field swa-field--full">
                <label htmlFor={ids.email}>Email <span className="swa-opt">(optional)</span></label>
                <input
                  {...fieldProps("email")}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  maxLength={254}
                />
                {fieldError("email")}
              </div>
            </div>

            <section className="swa-cart" aria-label="Your cart">
              <div className="swa-cart__head">
                <b>Your cart</b>
                <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
              </div>
              <ul className="swa-cart__list">
                {lines.map((l) => (
                  <li key={l.sku}>
                    <span className="swa-cart__qty">{l.qty}×</span>
                    <span className="swa-cart__name">{l.name}</span>
                    <span className="swa-cart__amt">{naira(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="swa-cart__total">
                <span>Total</span>
                <b>{naira(total)}</b>
              </div>
            </section>

            <p className="swa-note">
              <Lock size={14} aria-hidden="true" />
              Your cart stays saved here, so you can still check out online later.
            </p>

            {formError && <p className="swa-form-err" role="alert"><AlertCircle size={15} aria-hidden="true" /> {formError}</p>}

            <div className="swa-actions">
              <button type="button" className="swa-btn swa-btn--ghost" onClick={requestClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="swa-btn swa-btn--wa" disabled={submitting}>
                {submitting
                  ? <><Loader2 size={18} className="swa-spin" aria-hidden="true" /> Opening WhatsApp…</>
                  : <><MessageCircle size={18} aria-hidden="true" /> Continue on WhatsApp</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
