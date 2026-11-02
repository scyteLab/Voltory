/**
 * Nigerian mobile numbers — the ONE place they're parsed.
 *
 * Canonical (stored) format: 11-digit local form, no spaces,
 * e.g. "08050854444". That's what customers.phone (sign-in) and
 * orders.customer_phone already hold, so existing accounts and
 * order lookups keep matching. A few older customers rows hold
 * "+2348050854444"; samePhone() treats both as the same number.
 *
 * Accepted input: 08050854444, 8050854444, +2348050854444,
 * 2348050854444, 002348050854444, +234 805 085 4444, 0805-085-4444,
 * (0805) 085 4444, +234 0805 085 4444 (stray 0 after 234).
 *
 * Valid = 10 national digits, first 7/8/9, second 0/1
 * (070x, 080x, 081x, 090x, 091x …).
 *
 * Plain data, no browser APIs: safe in Netlify functions and scripts.
 */

export const PHONE_ERRORS = {
  required: "Phone number is required.",
  length: "Nigerian mobile numbers have 11 digits, e.g. 0803 123 4567.",
  country: "Please use a Nigerian mobile number (+234).",
  prefix: "That doesn't look like a Nigerian mobile number. Please check it.",
};

/**
 * Full check. Resolves { ok: true, phone, display } or { ok: false, error }.
 *   phone   — canonical "08050854444" (store this)
 *   display — "0805 085 4444" (show this)
 */
export function validateNgPhone(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: false, error: PHONE_ERRORS.required };

  let digits = raw.replace(/\D/g, "");
  let international = raw.startsWith("+");
  if (!international && digits.startsWith("00")) {
    // 00 is the international dialling prefix (00234…).
    digits = digits.slice(2);
    international = true;
  }

  let national;
  if (digits.startsWith("234")) {
    national = digits.slice(3);
    if (national.length === 11 && national.startsWith("0")) national = national.slice(1);
  } else if (international) {
    return { ok: false, error: PHONE_ERRORS.country };
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  if (national.length !== 10) return { ok: false, error: PHONE_ERRORS.length };
  if (!/^[789][01]/.test(national)) return { ok: false, error: PHONE_ERRORS.prefix };

  const phone = "0" + national;
  return { ok: true, phone, display: formatNgPhone(phone) };
}

/** Canonical "08050854444", or null if the input isn't a valid Nigerian mobile. */
export function normaliseNgPhone(input) {
  const res = validateNgPhone(input);
  return res.ok ? res.phone : null;
}

/** "08050854444" → "0805 085 4444". Anything unparseable is returned as given. */
export function formatNgPhone(input) {
  const s = String(input ?? "");
  const local = /^0\d{10}$/.test(s) ? s : normaliseNgPhone(s);
  return local ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : s;
}

/** "08050854444" → "+2348050854444" (for tel:/WhatsApp links). */
export function toIntlNgPhone(input) {
  const local = normaliseNgPhone(input);
  return local ? "+234" + local.slice(1) : null;
}

/** True when two inputs are the same Nigerian number in any format. */
export function samePhone(a, b) {
  const na = normaliseNgPhone(a) ?? String(a ?? "").replace(/\D/g, "");
  const nb = normaliseNgPhone(b) ?? String(b ?? "").replace(/\D/g, "");
  return Boolean(na) && na === nb;
}

/**
 * For form fields: validate on blur / submit.
 *   required: false → an empty field is fine (phone null).
 * Resolves { ok, phone, display, error }.
 */
export function checkPhoneField(input, { required = true } = {}) {
  if (!String(input ?? "").trim() && !required) return { ok: true, phone: null, display: "" };
  return validateNgPhone(input);
}

/**
 * onBlur handler body shared by every phone input: a valid number is
 * tidied to "0805 085 4444", an invalid one sets the error message.
 * An empty field is left alone (submit reports it if it's required).
 *   setError(null) clears the message.
 */
export function phoneBlur(value, setValue, setError, options) {
  if (!String(value ?? "").trim()) return;
  const res = checkPhoneField(value, options);
  if (res.ok) {
    setValue(res.display);
    setError(null);
  } else {
    setError(res.error);
  }
}
