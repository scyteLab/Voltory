import { supabase, supabaseConfigured } from "./supabaseClient.js";

/**
 * customerAuth — Session 30 (own-auth interim; Session 32 migrates to Supabase Auth).
 *
 * Two entry points that create customer rows:
 *   • verifyOtp()          — explicit signup / login. Creates a session.
 *   • upsertFromCheckout() — silent, from guest checkout. No session.
 *
 * Both flows share the same underlying "find-or-create customer by phone"
 * logic (findOrCreateCustomer) so a customer who checked out as a guest
 * and later signs up ends up merging into the same row cleanly.
 *
 * OTP is FAKE in this session — always "1234". The signup / login UIs
 * show a visible "Development Mode: OTP is 1234" banner. Session 32
 * replaces this with Termii + real codes.
 */

const TOKEN_KEY = "voltory_customer_session";
const DEV_OTP_CODE = "1234"; // TODO(session-32): remove after Termii lands.

/* ============================================================
   Phone normalisation
   ============================================================ */

/**
 * Normalise a Nigerian phone to +234NNNNNNNNNN.
 * Accepts 0803..., 234803..., +234 803 456 7890, etc.
 * Returns null if it doesn't look like a valid NG mobile.
 */
export function normalisePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  let core = digits;
  if (core.startsWith("234")) core = core.slice(3);
  else if (core.startsWith("0")) core = core.slice(1);
  if (core.length !== 10) return null;
  if (!/^[789]/.test(core)) return null; // NG mobile prefixes
  return "+234" + core;
}

/* ============================================================
   Session token helpers
   ============================================================ */

function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode etc */ }
}

/** 256 bits of randomness, hex-encoded. Bearer credential; looked up server-side. */
function generateSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex. Same function will still be used post-Termii. */
async function hashCode(code) {
  const buf = new TextEncoder().encode(String(code));
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/* ============================================================
   Shared: find-or-create customer by phone
   ============================================================ */

/**
 * Look up an existing customer by phone. If none exists, create one
 * with the given profile fields. If one exists, merge in any provided
 * fields without overwriting existing values.
 *
 * `source` is only applied on creation. A guest who later signs up
 * keeps source='guest' — which is honest and useful for analytics.
 * Session 32 can add a `has_signed_up` flag if we want to distinguish.
 */
async function findOrCreateCustomer({ phone, profile = {}, source = "guest" }) {
  const existing = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
  if (existing.error) return { ok: false, error: existing.error.message };

  if (existing.data) {
    // Merge in any new fields we have that aren't already set
    const patch = {};
    if (profile.name  && !existing.data.name)  patch.name  = profile.name;
    if (profile.email && !existing.data.email) patch.email = profile.email;
    if (profile.gender && !existing.data.gender) patch.gender = profile.gender;
    if (profile.dob   && !existing.data.dob)   patch.dob   = profile.dob;
    if (profile.marketing_opt_in && !existing.data.marketing_opt_in) {
      patch.marketing_opt_in = true;
    }
    if (!Object.keys(patch).length) return { ok: true, customer: existing.data };
    const upd = await supabase.from("customers")
      .update(patch)
      .eq("id", existing.data.id)
      .select()
      .single();
    if (upd.error) return { ok: false, error: upd.error.message };
    return { ok: true, customer: upd.data };
  }

  // Create fresh
  const ins = await supabase.from("customers")
    .insert({
      phone,
      source,
      name:  profile.name  || null,
      email: profile.email || null,
      gender: profile.gender || null,
      dob:   profile.dob   || null,
      marketing_opt_in: !!profile.marketing_opt_in,
    })
    .select()
    .single();
  if (ins.error) return { ok: false, error: ins.error.message };
  return { ok: true, customer: ins.data };
}

/* ============================================================
   Explicit signup / login flow (creates a session)
   ============================================================ */

/**
 * Request an OTP. Same call for signup and login; the `purpose` field
 * on the challenge row disambiguates. In dev, always returns the fake
 * code as `devCode` so the UI can display it.
 */
export async function requestOtp({ phone, purpose = "login" }) {
  const p = normalisePhone(phone);
  if (!p) return { ok: false, error: "That doesn't look like a Nigerian phone number." };
  if (!supabaseConfigured) return { ok: false, error: "Cannot reach account service." };

  const codeHash = await hashCode(DEV_OTP_CODE);

  // Always start fresh — clear any active challenges for this phone.
  await supabase.from("customer_otp_challenges").delete().eq("phone", p);

  const { error } = await supabase.from("customer_otp_challenges").insert({
    phone: p, code_hash: codeHash, purpose,
  });
  if (error) return { ok: false, error: error.message };

  // TODO(session-32): actually send via Termii.
  return { ok: true, devCode: DEV_OTP_CODE };
}

/**
 * Verify OTP + mint session. For purpose='signup', creates the customer
 * (or merges into an existing row from a prior guest checkout) with
 * source='signup' on new creation. For purpose='login', requires an
 * existing customer.
 */
export async function verifyOtp({ phone, code, purpose = "login", profile = {} }) {
  const p = normalisePhone(phone);
  if (!p) return { ok: false, error: "Phone number looks off." };
  if (!code || !/^\d{4}$/.test(String(code))) {
    return { ok: false, error: "Enter the 4-digit code." };
  }
  if (!supabaseConfigured) return { ok: false, error: "Cannot reach account service." };

  const codeHash = await hashCode(code);

  const { data: challenge, error: chErr } = await supabase
    .from("customer_otp_challenges")
    .select("*")
    .eq("phone", p)
    .eq("purpose", purpose)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (chErr) return { ok: false, error: chErr.message };
  if (!challenge) return { ok: false, error: "Your code expired. Request a new one." };
  if (challenge.attempts >= 5) return { ok: false, error: "Too many attempts. Request a new code." };
  if (challenge.code_hash !== codeHash) {
    await supabase.from("customer_otp_challenges")
      .update({ attempts: challenge.attempts + 1 })
      .eq("id", challenge.id);
    return { ok: false, error: "That code is incorrect." };
  }

  // Consume the challenge so it can't be replayed
  await supabase.from("customer_otp_challenges").delete().eq("id", challenge.id);

  // For login, require existing customer.
  // For signup, create or merge. If a guest row exists, this signup
  // silently upgrades it — no "welcome back" popup, per product decision.
  const existing = await supabase.from("customers").select("*").eq("phone", p).maybeSingle();
  if (existing.error) return { ok: false, error: existing.error.message };

  let customer;
  if (existing.data) {
    // Merge in profile fields for signup
    if (purpose === "signup") {
      const res = await findOrCreateCustomer({ phone: p, profile, source: "signup" });
      if (!res.ok) return res;
      customer = res.customer;
    } else {
      customer = existing.data;
    }
  } else {
    if (purpose === "login") {
      return { ok: false, error: "No account for that number yet. Try signing up." };
    }
    const res = await findOrCreateCustomer({ phone: p, profile, source: "signup" });
    if (!res.ok) return res;
    customer = res.customer;
  }

  // Mint session
  const token = generateSessionToken();
  const sess = await supabase.from("customer_sessions").insert({
    token,
    customer_id: customer.id,
    user_agent: (typeof navigator !== "undefined" ? navigator.userAgent : null),
  });
  if (sess.error) return { ok: false, error: sess.error.message };

  await supabase.from("customers")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", customer.id);

  setStoredToken(token);
  return { ok: true, customer, token };
}

/* ============================================================
   Guest checkout path (silent — NO session)
   ============================================================ */

/**
 * Called from StoreContext.placeOrder for every checkout. Ensures a
 * `customers` row exists for the phone number and returns its id so
 * the caller can persist it on the order.
 *
 * IMPORTANT: does NOT mint a session token. The customer stays a
 * guest from the browser's perspective — no /account access, no
 * "signed in" state. The only effect is a real DB record the admin
 * can see, and future orders will link cleanly.
 *
 * If the customer was previously signed in (either now or in the
 * past) and happens to use the same phone at checkout, no problem —
 * we find the existing row and reuse it. Their session (if any) is
 * unaffected.
 */
export async function upsertFromCheckout({ phone, name, email }) {
  const p = normalisePhone(phone);
  if (!p) return { ok: false, error: "Phone number invalid.", id: null };
  if (!supabaseConfigured) return { ok: false, error: "Supabase unreachable.", id: null };

  const res = await findOrCreateCustomer({
    phone: p,
    profile: { name, email },
    source: "guest",
  });
  if (!res.ok) return { ok: false, error: res.error, id: null };

  // Silently bump last_seen_at so this counts as activity
  await supabase.from("customers")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", res.customer.id);

  return { ok: true, id: res.customer.id };
}

/* ============================================================
   Session lifecycle
   ============================================================ */

/** Resolve current signed-in customer, or null. Renews last_seen_at fire-and-forget. */
export async function getCurrentCustomer() {
  const token = getStoredToken();
  if (!token) return null;
  if (!supabaseConfigured) return null;

  const now = new Date().toISOString();

  const { data: session, error } = await supabase
    .from("customer_sessions")
    .select("token, customer_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (error || !session) { setStoredToken(null); return null; }
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from("customer_sessions").delete().eq("token", token);
    setStoredToken(null);
    return null;
  }

  const { data: customer, error: cErr } = await supabase
    .from("customers").select("*").eq("id", session.customer_id).maybeSingle();
  if (cErr || !customer) { setStoredToken(null); return null; }

  // Fire-and-forget renewals — errors ignored
  supabase.from("customer_sessions")
    .update({ last_seen_at: now })
    .eq("token", token).then(() => {}, () => {});
  supabase.from("customers")
    .update({ last_seen_at: now })
    .eq("id", customer.id).then(() => {}, () => {});

  return customer;
}

export async function signOutCurrent() {
  const token = getStoredToken();
  setStoredToken(null);
  if (token && supabaseConfigured) {
    await supabase.from("customer_sessions").delete().eq("token", token);
  }
}

export async function updateProfile(patch) {
  const current = await getCurrentCustomer();
  if (!current) return { ok: false, error: "Not signed in." };
  const clean = {};
  for (const k of ["name", "email", "gender", "dob", "marketing_opt_in"]) {
    if (patch[k] !== undefined) clean[k] = patch[k];
  }
  if (!Object.keys(clean).length) return { ok: true, customer: current };
  const { data, error } = await supabase
    .from("customers").update(clean).eq("id", current.id).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, customer: data };
}