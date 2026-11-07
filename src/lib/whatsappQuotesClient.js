import { createClient } from "@supabase/supabase-js";
import { supabaseConfigured } from "./supabaseClient.js";

/**
 * whatsappQuotesClient
 *
 * Handles the "Send Cart to WhatsApp" flow:
 *
 *   1. generateQuoteRef()  — reference shown to the customer and saved
 *                            as whatsapp_quotes.id: NAV-Q-MMDD-XXXXX
 *   2. buildQuoteItems()   — cart lines → the items the RPC expects
 *   3. saveQuote()         — ONE call to create_whatsapp_quote(), which
 *                            saves header + items in one transaction
 *                            (supabase/whatsapp_quote_rpc.sql)
 *
 * WhatsApp opens FIRST (synchronously in the click, so popup blockers
 * allow it); the save runs afterwards in the background and never
 * blocks or undoes the WhatsApp step. The message carries the same
 * reference, so the sales rep can find the quote in admin.
 *
 * This writes ONLY to whatsapp_quotes / whatsapp_quote_items — never
 * to form_submissions or contact_messages, so it doesn't trigger the
 * "new form submission" email. (The whatsapp_quotes Database Webhook
 * sends its own "WhatsApp quote" alert to the orders inbox.)
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
   Cart → quote items
   ============================================================ */

/**
 * Paid cart lines → [{ sku, product_name, qty, unit_price, image }].
 * Gift lines have no catalog product and are skipped. The database
 * works out line totals and the subtotal itself.
 */
export function buildQuoteItems(cart, bySku) {
  return cart
    .filter((line) => !line.isGift)
    .map((line) => {
      const p = bySku(line.sku);
      if (!p) return null;
      return {
        sku: p.sku,
        product_name: p.name,
        qty: line.qty,
        unit_price: p.price,
        image: p.image || null,
      };
    })
    .filter(Boolean);
}

/* ============================================================
   Save (background, one request)
   ============================================================ */

// A separate client used only for this call: its fetch sets
// `keepalive`, so the request still completes if opening WhatsApp
// moves this tab away (phones without the WhatsApp app). No session
// handling — it's a guest call with the public anon key.
let keepaliveClient = null;
function quoteClient() {
  if (!keepaliveClient) {
    keepaliveClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "naven-wa-quote" },
      global: { fetch: (url, init) => fetch(url, { ...init, keepalive: true }) },
    });
  }
  return keepaliveClient;
}

/**
 * Save a quote. Resolves { ok: true, ref } or { ok: false, error };
 * never throws, so callers can fire and forget.
 *   contact: { name, phone, email } — phone in the stored "0803…" form
 *   ref in the result can differ from quoteId if that code was taken
 *   (the database then notes the customer's code on the quote).
 */
export async function saveQuote({ quoteId, items, customer = null, contact }) {
  if (!supabaseConfigured) {
    // eslint-disable-next-line no-console
    console.warn("[whatsappQuotes] Supabase not configured; quote not saved:", quoteId);
    return { ok: false, error: "not_configured" };
  }
  if (!items.length) {
    // eslint-disable-next-line no-console
    console.error("[whatsappQuotes] no items to save (catalog not loaded?); quote not saved:", quoteId);
    return { ok: false, error: "no_items" };
  }
  try {
    const { data, error } = await quoteClient().rpc("create_whatsapp_quote", {
      p_quote: {
        id: quoteId,
        customer_id: customer?.id || null,
        customer_name: contact.name,
        customer_phone: contact.phone,
        customer_email: contact.email || null,
      },
      p_items: items,
    });
    if (error) throw new Error(error.message || "RPC failed");
    if (data !== quoteId) {
      // eslint-disable-next-line no-console
      console.warn("[whatsappQuotes] reference was taken; saved as", data, "instead of", quoteId);
    }
    return { ok: true, ref: data };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[whatsappQuotes] save failed (WhatsApp already opened):", quoteId, err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}
