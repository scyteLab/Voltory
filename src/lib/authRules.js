/**
 * Customer account rules shared by the sign-up / sign-in / profile
 * forms (browser) and the customer-auth function (server). Pure: no
 * browser or Node APIs. The server is the one that enforces them.
 */
export const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72;   // bcrypt ignores anything after 72 bytes

export const GENDERS = ["female", "male", "other", "prefer_not_to_say"];

export const AUTH_ERROR_MESSAGES = {
  invalid_phone: "Please enter a valid Nigerian mobile number.",
  password_required: "Password is required.",
  password_too_short: `Password must be at least ${PASSWORD_MIN} characters.`,
  password_too_long: "That password is too long. Please use a shorter one.",
  name_required: "Name is required.",
  name_too_long: "Please shorten your name.",
  invalid_email: "Please check your email address.",
  invalid_gender: "Please choose a valid option.",
  invalid_dob: "Please check your date of birth.",
  invalid_marketing: "Please check your marketing preference.",
  nothing_to_update: "Nothing to update.",
  account_exists: "An account with this phone number already exists. Please sign in.",
  invalid_credentials: "Invalid phone number or password.",
  wrong_current_password: "Your current password is incorrect.",
  same_password: "Your new password must be different from the current one.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  unauthorized: "Please sign in again to continue.",
  offline: "We couldn't reach NAVEN. Please check your connection and try again.",
};

const utf8Bytes = (s) => new TextEncoder().encode(s).length;

/** → null | error code */
export function checkPassword(pw) {
  if (typeof pw !== "string" || pw === "") return "password_required";
  if (pw.length < PASSWORD_MIN) return "password_too_short";
  if (utf8Bytes(pw) > PASSWORD_MAX_BYTES) return "password_too_long";
  return null;
}

/** → { ok, value } | { ok:false, error } */
export function checkName(v) {
  const s = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  if (!s) return { ok: false, error: "name_required" };
  if (s.length > 100) return { ok: false, error: "name_too_long" };
  return { ok: true, value: s };
}

/** Empty → null (allowed). */
export function checkEmail(v) {
  if (v == null || (typeof v === "string" && v.trim() === "")) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, error: "invalid_email" };
  const s = v.trim().toLowerCase();
  if (s.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { ok: false, error: "invalid_email" };
  return { ok: true, value: s };
}

/**
 * update-profile whitelist: name, email, gender, dob, marketing_opt_in.
 * Anything else (phone, id, password_hash, created_at, …) is ignored.
 * → { ok:true, patch } | { ok:false, error }
 */
export function checkProfilePatch(input = {}, today = new Date()) {
  const patch = {};
  if ("name" in input) {
    const r = checkName(input.name);
    if (!r.ok) return r;
    patch.name = r.value;
  }
  if ("email" in input) {
    const r = checkEmail(input.email);
    if (!r.ok) return r;
    patch.email = r.value;
  }
  if ("gender" in input) {
    if (input.gender !== null && input.gender !== "" && !GENDERS.includes(input.gender)) return { ok: false, error: "invalid_gender" };
    patch.gender = input.gender || null;
  }
  if ("dob" in input) {
    if (input.dob === null || input.dob === "") patch.dob = null;
    else {
      const m = typeof input.dob === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.dob);
      const d = m && new Date(`${input.dob}T00:00:00Z`);
      if (!m || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== input.dob ||
          Number(m[1]) < 1900 || d > today) return { ok: false, error: "invalid_dob" };
      patch.dob = input.dob;
    }
  }
  if ("marketing_opt_in" in input) {
    if (typeof input.marketing_opt_in !== "boolean") return { ok: false, error: "invalid_marketing" };
    patch.marketing_opt_in = input.marketing_opt_in;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "nothing_to_update" };
  return { ok: true, patch };
}
