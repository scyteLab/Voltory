import { supabase, supabaseConfigured } from "./supabaseClient.js";

/**
 * whatsappQuotesClient
 *
 * Handles the "Send Cart to WhatsApp" flow:
 *
 *   1. generateQuoteId()      — unique reference: VQ-YYYYMMDDHHmm-XXXX
 *   2. saveQuote()            — writes quote header + items to Supabase
 *
 * The WhatsApp message itself is written by utils/whatsappMessage.js
 * (cartMessage), using the quoteId returned here as its "Quote ref".
 *
 * We save FIRST, open WhatsApp SECOND. If the save fails, the button
 * shows an error and doesn't open WhatsApp — otherwise the customer
 * could message the rep with a quote ID the rep can't find in admin.
 */

/* ============================================================
   ID generator (mirrors orders' VLT-YYYYMMDDHHmm-XXXX pattern)
   ============================================================ */

function pad(n) { return String(n).padStart(2, "0"); }

export function generateQuoteId() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VQ-${stamp}-${rand}`;
}

/* ============================================================
   Save to Supabase
   ============================================================ */

/**
 * Save a quote to Supabase. Returns { ok, quoteId, error }.
 * We save even if Supabase isn't configured (dev fallback: ok=true,
 * quoteId still generated) so the button never blocks in dev.
 */
export async function saveQuote({ cart, bySku, customer, contactName, contactPhone, contactEmail }) {
  const quoteId = generateQuoteId();

  // Build the items array from the cart + product lookup
  const items = cart.map((line) => {
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
  }).filter(Boolean);

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);

  if (!supabaseConfigured) {
    // Dev fallback — return the ID without saving so WhatsApp still opens
    // eslint-disable-next-line no-console
    console.warn("[whatsappQuotes] Supabase not configured; quote not persisted:", quoteId);
    return { ok: true, quoteId, subtotal, items };
  }

  try {
    // Insert the quote header first
    const { error: qErr } = await supabase
      .from("whatsapp_quotes")
      .insert({
        id: quoteId,
        customer_id: customer?.id || null,
        customer_name:  contactName?.trim() || customer?.name  || null,
        customer_phone: contactPhone?.trim() || customer?.phone || null,
        customer_email: contactEmail?.trim() || customer?.email || null,
        subtotal,
        status: "new",
      });
    if (qErr) {
      // eslint-disable-next-line no-console
      console.error("[whatsappQuotes] quote insert failed:", qErr);
      return { ok: false, error: qErr.message };
    }

    // Then insert all items in one shot
    if (items.length > 0) {
      const { error: iErr } = await supabase
        .from("whatsapp_quote_items")
        .insert(items);
      if (iErr) {
        // eslint-disable-next-line no-console
        console.error("[whatsappQuotes] items insert failed:", iErr);
        // Best-effort: we already have a quote header; the rep can still
        // find the customer even if items are missing. Report the error
        // but return ok=true so WhatsApp still opens.
        return { ok: true, quoteId, subtotal, items, warning: iErr.message };
      }
    }

    return { ok: true, quoteId, subtotal, items };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
