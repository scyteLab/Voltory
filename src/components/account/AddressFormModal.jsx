import { useState } from "react";
import { MapPin, X } from "lucide-react";

const NIGERIAN_STATES = [
  "Lagos", "Abuja FCT", "Rivers", "Oyo", "Kano", "Kaduna", "Ogun",
  "Anambra", "Enugu", "Delta", "Edo", "Cross River", "Akwa Ibom",
  "Plateau", "Bayelsa", "Imo", "Ondo", "Osun", "Other",
];

/**
 * AddressFormModal — create/edit sheet for a saved address.
 *
 * `address` is either:
 *   · an existing row (has `id`) — editing
 *   · a prefill shape from "save this" on a recent order (no `id`)
 *   · null — blank form
 *
 * onSubmit(input) must return { ok, error? } (matches useCustomerAddresses'
 * create/update contract) — the modal stays open and shows the error
 * inline on failure, closes itself on success.
 */
export default function AddressFormModal({ address, defaultName, defaultPhone, onClose, onSubmit }) {
  const isEdit = Boolean(address?.id);

  const [form, setForm] = useState({
    label:      address?.label      || "",
    name:       address?.name       || defaultName  || "",
    phone:      address?.phone      || defaultPhone || "",
    state:      address?.state      || "Lagos",
    lga:        address?.lga        || "",
    street:     address?.street     || "",
    landmark:   address?.landmark   || "",
    is_default: address?.is_default || false,
  });
  const [errors, setErrors] = useState({});
  const [formErr, setFormErr] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate() {
    const e = {};
    if (!form.state.trim()) e.state = "State is required";
    if (!form.lga.trim()) e.lga = "LGA / City is required";
    if (!form.street.trim()) e.street = "Street address is required";
    else if (form.street.trim().length < 5) e.street = "Include a house number and street name";
    return e;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitting(true);
    setFormErr(null);
    const res = await onSubmit(form);
    setSubmitting(false);

    if (!res?.ok) {
      setFormErr(res?.error || "Something went wrong — please try again.");
      return;
    }
    onClose();
  }

  return (
    <div className="addr-modal__backdrop" onClick={onClose}>
      <div
        className="addr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="addr-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="addr-modal__x" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        <h3 id="addr-modal-title">
          <MapPin size={18} /> {isEdit ? "Edit Address" : "Add New Address"}
        </h3>

        <form onSubmit={handleSubmit} noValidate>
          {formErr && <div className="addr-modal__err">{formErr}</div>}

          <div className="ck-grid">
            <label className="field">
              <span className="field__label">
                Label <small className="field__note">— e.g. Home, Office</small>
              </span>
              <input
                type="text"
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
                placeholder="Home"
              />
            </label>

            <label className="field">
              <span className="field__label">Recipient Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Full name"
              />
            </label>

            <label className="field field--full">
              <span className="field__label">Phone Number</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="080..."
              />
            </label>

            <label className={"field" + (errors.state ? " has-error" : "")}>
              <span className="field__label">State</span>
              <select value={form.state} onChange={(e) => set("state", e.target.value)}>
                {NIGERIAN_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
              {errors.state && <span className="field__error">{errors.state}</span>}
            </label>

            <label className={"field" + (errors.lga ? " has-error" : "")}>
              <span className="field__label">LGA / City</span>
              <input
                type="text"
                value={form.lga}
                onChange={(e) => set("lga", e.target.value)}
                placeholder="e.g. Lekki, Ikeja, Wuse"
              />
              {errors.lga && <span className="field__error">{errors.lga}</span>}
            </label>

            <label className={"field field--full" + (errors.street ? " has-error" : "")}>
              <span className="field__label">Street Address</span>
              <input
                type="text"
                value={form.street}
                onChange={(e) => set("street", e.target.value)}
                placeholder="House number, street, area"
              />
              {errors.street && <span className="field__error">{errors.street}</span>}
            </label>

            <label className="field field--full">
              <span className="field__label">Landmark (optional)</span>
              <input
                type="text"
                value={form.landmark}
                onChange={(e) => set("landmark", e.target.value)}
                placeholder="e.g. Behind GTBank Lekki Phase 1"
              />
            </label>
          </div>

          <label className="addr-modal__default">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => set("is_default", e.target.checked)}
            />
            <span>Set as default address</span>
          </label>

          <div className="addr-modal__actions">
            <button type="button" className="addr-modal__cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="addr-modal__save" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Add Address"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
