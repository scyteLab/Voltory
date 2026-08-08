import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * AddressFormModal
 *
 * Create/edit an entry in customer_addresses. Mirrors Checkout's
 * address form shape (state / lga / street / landmark) plus a few
 * extras that make it useful as a saved-address:
 *   \u00B7 Label \u2014 "Home", "Office", "Mum's place"
 *   \u00B7 Recipient name + phone \u2014 for gift deliveries etc
 *   \u00B7 is_default checkbox
 *
 * Reuses .cat-modal__* styles from the admin categories modal since
 * the shape is identical.
 */

const NIGERIAN_STATES = [
  "Lagos", "Abuja FCT", "Rivers", "Oyo", "Kano", "Kaduna", "Ogun",
  "Anambra", "Enugu", "Delta", "Edo", "Cross River", "Akwa Ibom",
  "Plateau", "Bayelsa", "Imo", "Ondo", "Osun", "Other",
];

export default function AddressFormModal({ address, defaultName, defaultPhone, onClose, onSubmit }) {
  const isEdit = !!address;

  const [label, setLabel]       = useState(address?.label || "");
  const [name, setName]         = useState(address?.name  ?? (defaultName || ""));
  const [phone, setPhone]       = useState(address?.phone ?? (defaultPhone || ""));
  const [state, setState]       = useState(address?.state || "Lagos");
  const [lga, setLga]           = useState(address?.lga || "");
  const [street, setStreet]     = useState(address?.street || "");
  const [landmark, setLandmark] = useState(address?.landmark || "");
  const [isDefault, setIsDefault] = useState(!!address?.is_default);

  const [error, setError]           = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const firstFieldRef               = useRef(null);

  useEffect(() => {
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    setSubmitting(true);
    const res = await onSubmit({
      label, name, phone, state, lga, street, landmark,
      is_default: isDefault,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Something went wrong");
      return;
    }
    onClose();
  }

  return (
    <div className="cat-modal__scrim" onClick={onClose}>
      <div className="cat-modal cat-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="cat-modal__head">
          <h2>{isEdit ? "Edit address" : "Add new address"}</h2>
          <button type="button" className="cat-modal__x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="cat-modal__body">

          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="addr-label">Label <span className="addr-modal__opt">(optional)</span></label>
            <input
              id="addr-label"
              ref={firstFieldRef}
              type="text"
              className="hb-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Home, Office"
              maxLength={30}
            />
            <p className="cat-modal__hint">Helps you tell your saved addresses apart.</p>
          </div>

          <div className="addr-modal__row">
            <div className="cat-modal__field">
              <label className="hb-lbl" htmlFor="addr-name">Recipient name</label>
              <input
                id="addr-name"
                type="text"
                className="hb-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Who is receiving the delivery"
                required
              />
            </div>
            <div className="cat-modal__field">
              <label className="hb-lbl" htmlFor="addr-phone">Phone</label>
              <input
                id="addr-phone"
                type="tel"
                className="hb-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0803 123 4567"
                required
              />
            </div>
          </div>

          <div className="addr-modal__row">
            <div className="cat-modal__field">
              <label className="hb-lbl" htmlFor="addr-state">State</label>
              <select
                id="addr-state"
                className="hb-input"
                value={state}
                onChange={(e) => setState(e.target.value)}
              >
                {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="cat-modal__field">
              <label className="hb-lbl" htmlFor="addr-lga">LGA / City</label>
              <input
                id="addr-lga"
                type="text"
                className="hb-input"
                value={lga}
                onChange={(e) => setLga(e.target.value)}
                placeholder="Ikeja, Lekki, Surulere\u2026"
                required
              />
            </div>
          </div>

          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="addr-street">Street address</label>
            <input
              id="addr-street"
              type="text"
              className="hb-input"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="e.g. 12 Awolowo Road, Ikoyi"
              required
            />
            <p className="cat-modal__hint">Include house/apartment number and street name.</p>
          </div>

          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="addr-landmark">Landmark <span className="addr-modal__opt">(optional)</span></label>
            <input
              id="addr-landmark"
              type="text"
              className="hb-input"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Opposite Ikoyi Baptist Church"
            />
            <p className="cat-modal__hint">Helps our delivery team find you faster.</p>
          </div>

          <div className="cat-modal__field cat-modal__field--row">
            <label className="cat-modal__switch">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span>Set as my default delivery address</span>
            </label>
          </div>

          {error && <div className="cat-modal__err">{error}</div>}

          <div className="cat-modal__actions">
            <button type="button" onClick={onClose} className="adm-btn adm-btn--secondary">
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={submitting}>
              {submitting ? "Saving\u2026" : isEdit ? "Save changes" : "Add address"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}