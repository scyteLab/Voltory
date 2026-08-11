/**
 * send-email  \u2014  Netlify serverless function
 *
 * Receives an email payload from the browser and forwards it to
 * Resend's API. This function runs on Netlify's servers, so it can
 * safely hold the RESEND_API_KEY (which must NEVER be in the client
 * bundle).
 *
 * Expected env vars (set on Netlify dashboard \u2192 Site settings \u2192
 * Environment variables):
 *   RESEND_API_KEY        \u2014 from https://resend.com/api-keys
 *   RESEND_FROM_EMAIL     \u2014 the verified sender, e.g. "orders@voltory.ng"
 *   RESEND_ADMIN_EMAIL    \u2014 where admin notifications go, e.g. "sales@voltory.ng"
 *
 * If RESEND_API_KEY is missing, the function returns 200 with
 * { ok: true, skipped: true } so the browser flow doesn't break \u2014
 * matches the "silent no-op if not configured" pattern used across
 * the whole backend.
 *
 * Request body:
 *   {
 *     type: "order_confirmation" | "order_admin_notify",
 *     to:      string,     // recipient email (customer for confirmation, admin for notify)
 *     subject: string,
 *     html:    string,     // HTML body
 *     text:    string      // plain-text fallback
 *   }
 *
 * Response:
 *   200 { ok: true, id: "..." }   \u2014 email sent
 *   200 { ok: true, skipped: true } \u2014 Resend not configured
 *   4xx { ok: false, error: "..." } \u2014 bad input / auth
 *   5xx { ok: false, error: "..." } \u2014 upstream failure
 */

export const handler = async (event) => {
  // CORS \u2014 allow same-origin only (Netlify serves the SPA on the same
  // domain, so no cross-origin headers needed). But be explicit.
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Method not allowed" }),
    };
  }

  // Parse body
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: "Invalid JSON body" }),
    };
  }

  const { type, to, subject, html, text } = payload;

  // Basic validation
  if (!type || !to || !subject || !html) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: false,
        error: "Missing required fields: type, to, subject, html",
      }),
    };
  }

  // Env check
  const apiKey    = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.warn("[send-email] Resend not configured, skipping. type=" + type);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, skipped: true, reason: "Resend not configured" }),
    };
  }

  // Send via Resend
  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ""),
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("[send-email] Resend API error:", resendData);
      return {
        statusCode: resendRes.status,
        headers: corsHeaders,
        body: JSON.stringify({
          ok: false,
          error: resendData.message || resendData.error || "Resend API error",
        }),
      };
    }

    console.log("[send-email] sent", { type, to, id: resendData.id });
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, id: resendData.id }),
    };
  } catch (err) {
    console.error("[send-email] fetch error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: err.message || "Unknown error" }),
    };
  }
};