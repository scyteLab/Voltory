import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import { naira } from "../../utils/format.js";
import {
  saveQuote, buildWhatsappMessage, buildWhatsappUrl,
} from "../../lib/whatsappQuotesClient.js";

/**
 * SendToWhatsappModal
 *
 * Small modal that appears when the customer clicks "Send Cart to
 * WhatsApp" on the cart page. Captures name + phone (pre-filled if
 * signed in), previews the message that will be sent, and on submit:
 *
 *   1. Saves the quote to Supabase (with items)
 *   2. Opens WhatsApp with the pre-filled message
 *
 * We use window.open() with '_blank' so the WA URL opens in a new
 * tab / the WhatsApp app rather than navigating away from the cart.
 * That way if the customer changes their mind, they can still
 * proceed to normal checkout without losing their cart.
 */
export default function SendToWhatsappModal({ onClose }) {
  const { customer } = useCustomerAuth();
  const { cart, totals } = useStore();
  const { bySku } = useCatalog();

  // Pre-fill from signed-in customer if any; strip +234 for display
  const displayPhone = (customer?.phone || "").startsWith("+234")
    ? "0" + customer.phone.slice(4)
    : (customer?.phone || "");

  const [name, setName]   = useState(customer?.name || "");
  const [phone, setPhone] = useState(displayPhone);
  const [email, setEmail] = useState(customer?.email || "");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 50);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Please enter your name"); return; }
    if (!/^0[789][01]\d{8}$/.test(phone.replace(/\s/g, ""))) {
      setError("Enter a valid Nigerian phone number");
      return;
    }

    setSubmitting(true);
    const res = await saveQuote({
      cart, bySku, customer,
      contactName: name, contactPhone: phone, contactEmail: email,
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || "Something went wrong. Please try again.");
      return;
    }

    const message = buildWhatsappMessage({
      quoteId: res.quoteId,
      subtotal: res.subtotal,
      items: res.items,
      contactName: name,
    });
    const url = buildWhatsappUrl(message);

    // Open in new tab / handoff to WhatsApp app
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div className="cat-modal__scrim" onClick={onClose}>
      <div className="cat-modal cat-modal--wide swa-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="cat-modal__head">
          <h2>
            <MessageCircle size={18} className="swa-modal__icon" />
            Send Cart to WhatsApp
          </h2>
          <button type="button" className="cat-modal__x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="cat-modal__body">
          <p className="cat-modal__hint">
            Our sales team will reach out on WhatsApp to confirm availability, apply any
            deals, and arrange delivery. You keep browsing while we prepare your quote.
          </p>

          <div className="swa-modal__row">
            <div className="cat-modal__field">
              <label className="hb-lbl" htmlFor="swa-name">Your name</label>
              <input
                id="swa-name"
                ref={nameRef}
                type="text"
                className="hb-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="First and last name"
                required
              />
            </div>
            <div className="cat-modal__field">
              <label className="hb-lbl" htmlFor="swa-phone">Phone</label>
              <input
                id="swa-phone"
                type="tel"
                className="hb-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0803 123 4567"
                required
              />
            </div>
          </div>

          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="swa-email">Email <span className="addr-modal__opt">(optional)</span></label>
            <input
              id="swa-email"
              type="email"
              className="hb-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          {/* Cart preview */}
          <div className="swa-modal__preview">
            <div className="swa-modal__preview-head">
              <b>Your cart</b>
              <span>{cart.length} item{cart.length === 1 ? "" : "s"} \u00B7 {naira(totals.subtotal)}</span>
            </div>
            <ul>
              {cart.slice(0, 4).map((line) => {
                const p = bySku(line.sku);
                if (!p) return null;
                return (
                  <li key={line.sku}>
                    <span className="swa-modal__preview-qty">{line.qty}\u00D7</span>
                    <span className="swa-modal__preview-name">{p.name}</span>
                    <span className="swa-modal__preview-price">{naira(p.price * line.qty)}</span>
                  </li>
                );
              })}
              {cart.length > 4 && (
                <li className="swa-modal__preview-more">
                  + {cart.length - 4} more item{cart.length - 4 === 1 ? "" : "s"}
                </li>
              )}
            </ul>
          </div>

          {error && <div className="cat-modal__err">{error}</div>}

          <div className="cat-modal__actions">
            <button type="button" onClick={onClose} className="adm-btn adm-btn--secondary">
              Cancel
            </button>
            <button type="submit" className="btn-shop swa-modal__submit" disabled={submitting}>
              {submitting ? "Preparing\u2026" : (
                <><MessageCircle size={15} /> Open WhatsApp</>
              )}
            </button>
          </div>

          <p className="swa-modal__note">
            We'll save your cart with a reference number and open WhatsApp to
            our sales line. Your cart stays intact if you want to check out
            online later.
          </p>
        </form>
      </div>
    </div>
  );
}