/**
 * Saved-address rules shared by the address form (browser) and the
 * customer-data function (server). Pure: no browser or Node APIs.
 * Only these fields are ever written; customer_id comes from the session.
 */
const text = (v, max) => {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return s.slice(0, max);
};

/** input → { ok:true, value:{ label, name, phone, state, lga, street, landmark, is_default } } | { ok:false, error } */
export function validateAddressInput(input) {
  if (!input || typeof input !== "object") return { ok: false, error: "Please fill in the address." };
  const value = {
    label:    text(input.label, 40) || null,
    name:     text(input.name, 100) || null,
    phone:    text(input.phone, 20) || null,
    state:    text(input.state, 40),
    lga:      text(input.lga, 80),
    street:   text(input.street, 300),
    landmark: text(input.landmark, 200) || null,
    is_default: input.is_default === true,
  };
  if (!value.state) return { ok: false, error: "State is required" };
  if (!value.lga) return { ok: false, error: "LGA / City is required" };
  if (!value.street) return { ok: false, error: "Street address is required" };
  if (value.street.length < 5) return { ok: false, error: "Street address seems too short — include a house number and street name" };
  if (value.phone && !/^[+\d][\d\s()-]{6,19}$/.test(value.phone)) return { ok: false, error: "Please check the phone number" };
  return { ok: true, value };
}
