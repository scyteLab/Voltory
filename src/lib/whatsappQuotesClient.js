import { supabaseConfigured } from "./supabaseClient.js";

/**
 * whatsappQuotesClient
 *
 * Handles the "Send Cart to WhatsApp" flow:
 *
 *   1. generateQuoteRef()  — reference shown to the customer and saved
 *                            as whatsapp_quotes.id: NAV-Q-MMDD-XXXXX
 *   2. buildQuoteItems()   — cart lines → whatsapp_quote_items rows
 *   3. saveQuote()         — writes quote header + items to Supabase
 *
 * WhatsApp opens FIRST (synchronously in the click, so popup blockers
 * allow it); the save runs afterwards in the background and never
 * blocks or undoes the WhatsApp step. The message carries the same
 * reference, so the sales rep can find the quote in admin.
 *
 * This writes ONLY to whatsapp_quotes / whatsapp_quote_items — never
 * to form_submissions or contact_messages, so it doesn't trigger the
 * "new form submission" email. (The whatsapp_quotes Database Webhook
 * sends its own "WhatsApp quote" alert.)
 */

/* ============================================================
   Reference: NAV-Q-<month><day>-<5 random>, e.g. NAV-Q-1107-7F3K2
   ============================================================ */

// No 0/O or 1/I, so it can be read out over the phone.
const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateQuoteRef() {
  const d = new Date();
  const mmdd = String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const rand = Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
  return `NAV-Q-${mmdd}-${rand}`;
}

/* ============================================================
   Cart → quote item rows
   ============================================================ */

/** Paid cart lines → whatsapp_quote_items rows (gift lines have no catalog product). */
export function buildQuoteItems(cart, bySku, quoteId) {
  return cart
    .filter((line) => !line.isGift)
    .map((line) => {
      const p = bySku(line.sku);
      if (!p) return null;
      return {
        quote_id: quoteId,
        sku: p.sku,
        product_name: p.name,
        qty: line.qty,
        unit_price: p.price,
        line_total: p.price * line.qty,
        image: p.image || null,
      };
    })
    .filter(Boolean);
}

/* ============================================================
   Save to Supabase (background)
   ============================================================ */

// Direct PostgREST calls with `keepalive`, so the save still completes
// if opening WhatsApp moves this tab away (mobile without the app).
async function insertRows(table, rows) {
  const url = import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, "");
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    keepalive: true,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`${table} insert failed: HTTP ${res.status} ${body.message || ""}`.trim());
  }
}

/**
 * Save a quote. Resolves { ok: true } or { ok: false, error }; never
 * throws, so callers can fire and forget.
 *   contact: { name, phone, email } — phone in the stored "0803…" form
 */
export async function saveQuote({ quoteId, items, subtotal, customer = null, contact }) {
  if (!supabaseConfigured) {
    // eslint-disable-next-line no-console
    console.warn("[whatsappQuotes] Supabase not configured; quote not saved:", quoteId);
    return { ok: false, error: "not_configured" };
  }
  try {
    // Header first: whatsapp_quote_items has an FK to whatsapp_quotes.id.
    await insertRows("whatsapp_quotes", {
      id: quoteId,
      customer_id: customer?.id || null,
      customer_name:  contact.name?.trim() || customer?.name || null,
      customer_phone: contact.phone || customer?.phone || null,
      customer_email: contact.email?.trim() || null,
      subtotal,
      status: "new",
    });
    if (items.length) await insertRows("whatsapp_quote_items", items);
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[whatsappQuotes] save failed (WhatsApp already opened):", quoteId, err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}
