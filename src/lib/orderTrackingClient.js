import { supabase } from "./supabaseClient.js";

/**
 * orderTrackingClient  \u2014  guest order lookup
 *
 * Public API:
 *   trackOrder({ orderId, phone })  \u2192 { ok, order?, items?, error? }
 *
 * Contract:
 *   \u00B7 orderId is the customer-facing ID (e.g. "VLT-202607301542-TRZX")
 *   \u00B7 phone is the customer's phone in any Nigerian format
 *     ("08099887766", "234...", "+234...") \u2014 we normalize
 *
 * Rate limiting:
 *   \u00B7 Max 10 tracking attempts per IP per hour
 *   \u00B7 Every attempt (success or fail) is logged for the limiter
 *   \u00B7 The response never distinguishes "wrong phone" from
 *     "wrong order id" \u2014 always a generic "no order found" so
 *     attackers can't confirm which half they got right
 *
 * Security notes:
 *   \u00B7 The Supabase policy allows anon reads on orders/order_items
 *     but the client library always filters by (id + phone).
 *     Enumeration is prevented by requiring both.
 *   \u00B7 IP address is best-effort \u2014 we get it via a public
 *     IP service if available, otherwise fall back to a
 *     browser fingerprint hash (weaker but still limits abuse)
 */

const MAX_ATTEMPTS_PER_HOUR = 10;

function normalizePhone(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/[^\d]/g, "");
  if (digits.startsWith("234") && digits.length === 13) return "0" + digits.slice(3);
  if (digits.startsWith("0")   && digits.length === 11) return digits;
  if (digits.length === 10 && /^[7-9]/.test(digits))    return "0" + digits;
  return digits;
}

function normalizeOrderId(id) {
  if (!id) return "";
  return String(id).trim().toUpperCase();
}

/**
 * Best-effort IP identification. If a public IP service is
 * blocked, falls back to a stable browser identifier so at
 * least single-browser abuse can be throttled.
 */
async function getClientId() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    if (data?.ip) return data.ip;
  } catch { /* fall through to fingerprint */ }

  // Fallback: crude but stable per-browser identifier
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join("|");

  try {
    const enc = new TextEncoder().encode(raw);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return "fp:" + Array.from(new Uint8Array(buf))
      .slice(0, 8)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return "fp:unknown";
  }
}

/**
 * Log a tracking attempt (fire-and-forget).
 * Rate-limit check is separate and happens before this.
 */
function logAttempt(clientId, success) {
  supabase
    .from("order_tracking_attempts")
    .insert({ ip_address: clientId, success })
    .then(() => {}, () => {});
}

/**
 * Check if this client has exceeded the hourly attempt limit.
 * Returns { limited: true, retryInMinutes } or { limited: false }.
 */
async function checkRateLimit(clientId) {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  try {
    const { count } = await supabase
      .from("order_tracking_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", clientId)
      .gt("created_at", cutoff);

    if (count != null && count >= MAX_ATTEMPTS_PER_HOUR) {
      return { limited: true, retryInMinutes: 60 };
    }
    return { limited: false };
  } catch {
    return { limited: false }; // fail open on rate-limit errors
  }
}

/**
 * Look up an order by id + phone. Returns full order + items
 * on success, or a generic error otherwise. Never leaks whether
 * the id was right and phone wrong (or vice versa).
 */
export async function trackOrder({ orderId, phone }) {
  const cleanId    = normalizeOrderId(orderId);
  const cleanPhone = normalizePhone(phone);

  if (!cleanId) return { ok: false, error: "Please enter your order number." };
  if (!cleanPhone) return { ok: false, error: "Please enter your phone number." };

  const clientId = await getClientId();

  /* Rate limit check */
  const rate = await checkRateLimit(clientId);
  if (rate.limited) {
    return {
      ok: false,
      error: `Too many lookup attempts. Please try again in about an hour.`,
    };
  }

  try {
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", cleanId)
      .eq("customer_phone", cleanPhone)
      .maybeSingle();

    if (orderErr) {
      logAttempt(clientId, false);
      return { ok: false, error: "Couldn't look up that order. Please try again." };
    }

    if (!order) {
      logAttempt(clientId, false);
      return {
        ok: false,
        error: "No order found with that order number and phone. Please check both and try again.",
      };
    }

    /* Order found \u2014 fetch its items */
    const { data: items, error: itemsErr } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", cleanId);

    if (itemsErr) {
      logAttempt(clientId, true); // order was found, item fetch failed
      return { ok: true, order, items: [] };
    }

    logAttempt(clientId, true);
    return { ok: true, order, items: items || [] };
  } catch (err) {
    logAttempt(clientId, false);
    return { ok: false, error: err?.message || "Something went wrong. Please try again." };
  }
}

/**
 * Human-readable status label + color hint.
 * Status values observed: pending, paid, cancelled, delivered,
 * shipped, refunded, plus payment_status separately.
 */
export function statusInfo(status) {
  const map = {
    pending:   { label: "Pending",   tone: "warn"  },
    paid:      { label: "Paid",      tone: "info"  },
    confirmed: { label: "Confirmed", tone: "info"  },
    processing:{ label: "Processing",tone: "info"  },
    shipped:   { label: "Shipped",   tone: "info"  },
    delivered: { label: "Delivered", tone: "good"  },
    cancelled: { label: "Cancelled", tone: "bad"   },
    refunded:  { label: "Refunded",  tone: "muted" },
  };
  const key = String(status || "").toLowerCase();
  return map[key] || { label: status || "Unknown", tone: "muted" };
}

/**
 * Estimate a delivery ETA based on order date + status.
 * Very rough \u2014 real logistics tracking would come from a
 * carrier integration. This is a "here's roughly when to
 * expect it" heuristic.
 */
export function estimateEta(order) {
  if (!order?.created_at) return null;
  const status = String(order.status || "").toLowerCase();

  if (status === "delivered")  return { text: "Delivered", isPast: true };
  if (status === "cancelled")  return { text: "Cancelled", isPast: true };
  if (status === "refunded")   return { text: "Refunded",  isPast: true };

  /* Extract state from address JSONB to guess ETA */
  const state = String(order.address?.state || "").toLowerCase();
  const isLagos = state.includes("lagos");

  const created = new Date(order.created_at);
  const daysToAdd = isLagos ? 3 : 7;
  const eta = new Date(created.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

  const now = new Date();
  const isPast = eta.getTime() < now.getTime();

  return {
    text: eta.toLocaleDateString("en-NG", {
      weekday: "short", day: "numeric", month: "short",
    }),
    isPast,
  };
}