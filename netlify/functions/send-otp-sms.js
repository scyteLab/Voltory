/**
 * Netlify Function: send-otp-sms
 *
 * Delivers a plaintext OTP code to a phone via Termii's SMS API.
 * Mirrors the shape of send-email.js so both functions have the
 * same operational surface (CORS, error shape, env-var fallback).
 *
 * Why a Netlify Function and not a direct browser \u2192 Termii call:
 *   \u00B7 TERMII_API_KEY stays server-side (never exposed to the
 *     browser bundle)
 *   \u00B7 Termii API does not permit CORS from browsers anyway
 *   \u00B7 Any future rate limiting, logging, or delivery-status
 *     handling lives in one place
 *
 * Environment variables (set in Netlify \u2192 Site settings \u2192
 * Environment variables):
 *   USE_REAL_SMS      \u2014 "true" to send real Termii SMS,
 *                        anything else = fake/dev mode
 *   TERMII_API_KEY    \u2014 from Termii dashboard \u2192 Developer
 *   TERMII_SENDER_ID  \u2014 approved sender name (e.g. "NAVEN")
 *
 * When USE_REAL_SMS is not "true":
 *   \u00B7 Function returns { ok: true, mode: "dev", devCode }
 *   \u00B7 Caller displays the code somewhere for dev testing
 *   \u00B7 No SMS sent, no cost incurred, no Termii dependency
 *
 * When USE_REAL_SMS is "true":
 *   \u00B7 Calls Termii's SMS send endpoint
 *   \u00B7 Returns { ok: true, mode: "sms", messageId } on success
 *   \u00B7 Returns { ok: false, error } on failure
 *   \u00B7 devCode is NEVER returned (would defeat SMS security)
 *
 * This function DOES NOT generate the OTP code. The caller
 * (customerAuth.js) generates the code, hashes it for the DB,
 * and sends the plaintext to this function for delivery.
 * Separation of concerns: DB writes stay in the client library,
 * external API calls stay in the Netlify function.
 */

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, max-age=0",
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
};

/**
 * Format a Nigerian phone number for Termii.
 *
 * Termii expects the phone WITHOUT a leading + but WITH the
 * country code prefix. So:
 *   08031234567     \u2192 2348031234567
 *   +2348031234567  \u2192 2348031234567
 *   2348031234567   \u2192 2348031234567  (already correct)
 *   8031234567      \u2192 2348031234567
 *
 * Bad or unrecognizable formats return null; caller should reject.
 */
function formatPhoneForTermii(phone) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  if (!digits) return null;

  // Already in international form
  if (digits.startsWith("234") && digits.length === 13) return digits;

  // Local Nigerian form (0-prefixed)
  if (digits.startsWith("0") && digits.length === 11) {
    return "234" + digits.slice(1);
  }

  // Missing leading 0, missing country code (e.g. "8031234567")
  if (digits.length === 10 && /^[7-9]/.test(digits)) {
    return "234" + digits;
  }

  return null;
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  const USE_REAL_SMS     = process.env.USE_REAL_SMS === "true";
  const TERMII_API_KEY   = process.env.TERMII_API_KEY;
  const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || "NAVEN";

  /* ---- Parse & validate payload ---- */
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, error: "Invalid JSON payload" }),
    };
  }

  const { phone, code } = payload;
  if (!phone || !code) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, error: "phone and code are required" }),
    };
  }

  /* ---- DEV mode: no Termii, return the code so caller can
          surface it (dashboard toast, console, etc.) ---- */
  if (!USE_REAL_SMS) {
    console.log("[send-otp-sms] dev mode \u2014 not sending SMS, code:", code);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: true,
        mode: "dev",
        devCode: code,
        note: "Set USE_REAL_SMS=true in Netlify env to send real SMS via Termii.",
      }),
    };
  }

  /* ---- REAL mode: send via Termii ---- */

  if (!TERMII_API_KEY) {
    console.warn("[send-otp-sms] USE_REAL_SMS is true but TERMII_API_KEY is not set.");
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: "SMS service not configured. Contact support.",
      }),
    };
  }

  const to = formatPhoneForTermii(phone);
  if (!to) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: "Unrecognized Nigerian phone format.",
      }),
    };
  }

  /* Termii SMS API payload.
     Endpoint docs: https://developer.termii.com/messaging-api
     Using the general SMS endpoint (not the OTP-generator endpoint)
     because WE generate the code and hash it before storing \u2014
     Termii only handles delivery. */

  const smsBody = `Your NAVEN verification code is ${code}. Valid for 5 minutes. Do not share this code with anyone.`;

  try {
    const response = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from: TERMII_SENDER_ID,
        sms:  smsBody,
        type: "plain",
        channel: "dnd",              // Deliver even to DND-registered numbers
        api_key: TERMII_API_KEY,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn(
        "[send-otp-sms] Termii error:",
        response.status,
        result?.message || JSON.stringify(result)
      );
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          ok: false,
          error: result?.message || `SMS delivery failed (${response.status})`,
        }),
      };
    }

    console.log("[send-otp-sms] Termii accepted:", result?.message_id || "no id");

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok:        true,
        mode:      "sms",
        messageId: result?.message_id || null,
      }),
    };
  } catch (err) {
    console.error("[send-otp-sms] Termii request threw:", err);
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        ok: false,
        error: "Network error contacting SMS provider. Try again in a moment.",
      }),
    };
  }
};                             