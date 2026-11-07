import { SITE } from "../config/site.js";

/**
 * WhatsApp messages about products — the ONE place they're written.
 * Used by the product page ("Need help choosing?", Q&A, reviews) and
 * Send Cart to WhatsApp. Product-page messages use WhatsApp
 * formatting (*bold*); the cart message is plain text.
 *
 *   whatsappUrl(message)        → https://wa.me/<NAVEN number>?text=…
 *   productHelpMessage(product) → "Need help choosing?" text
 *   cartMessage({...})          → Send Cart to WhatsApp text (≤ ~1,500 chars)
 */

const MAX_CHARS = 1500;
const MAX_ITEMS = 10;

/** ₦1,234,567 — whole naira, en-NG grouping, same as the site. */
export function nairaText(n) {
  return SITE.currencySymbol + Math.round(Number(n) || 0).toLocaleString("en-NG");
}

/** Full product URL on the public site. */
export function productUrl(product) {
  return `${SITE.siteUrl}/product/${encodeURIComponent(product.slug || product.sku)}`;
}

/** wa.me link to NAVEN's WhatsApp number with the message pre-filled. */
export function whatsappUrl(message) {
  const digits = String(SITE.whatsapp || "").replace(/\D+/g, "");
  return message
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${digits}`;
}

const clean = (s, max = 90) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Product page "Need help choosing?" (and the Q&A tab). */
export function productHelpMessage(product) {
  return [
    "Hello NAVEN 👋",
    "I'm interested in this product and would like some help:",
    `*${clean(product.name, 120)}*`,
    `SKU: ${product.sku} · Price: *${nairaText(product.price)}*`,
    productUrl(product),
    "",
    "My question:",
  ].join("\n");
}

/** Product page "share a review" link. */
export function productReviewMessage(product) {
  return [
    "Hello NAVEN 👋",
    "I recently bought this product and would like to share a review:",
    `*${clean(product.name, 120)}*`,
    `SKU: ${product.sku}`,
    productUrl(product),
    "",
    "My review:",
  ].join("\n");
}

/**
 * Send Cart to WhatsApp message (plain text, no *bold*: it's what the
 * customer sends us, so it should read like they wrote it).
 *   items:  [{ name, sku, qty, unitPrice }]   paid lines, in cart order
 *   gifts:  [{ name, giftFor }]               free gifts (giftFor = paid SKU)
 *   total, name, phone ("+234…"), email (optional), quoteRef
 *
 *   Hello NAVEN, I'd like to order:
 *
 *   1 × KENWOOD CERAMIC IRON (SKU STP75) — ₦64,350
 *
 *   Total: ₦64,350
 *   Name: Ada Obi
 *   Phone: +2348031234567
 *   Ref: NAV-Q-1107-7F3K2
 *
 * Lists up to 10 items; if the text would pass ~1,500 characters it
 * lists fewer, and the rest become "+ N more items (full list on Ref)".
 */
export function cartMessage({ items, gifts = [], total, name = "", phone = "", email = "", quoteRef = "" }) {
  const giftsFor = new Map();
  for (const g of gifts) {
    if (!giftsFor.has(g.giftFor)) giftsFor.set(g.giftFor, []);
    giftsFor.get(g.giftFor).push(g);
  }

  const itemLines = (item) => [
    `${item.qty} × ${clean(item.name)}${item.sku ? ` (SKU ${item.sku})` : ""} — ${nairaText(item.unitPrice * item.qty)}`,
    // Offer titles often start with "Free …"; don't print "Free gift: Free …".
    ...(giftsFor.get(item.sku) || []).map((g) => `   + Free gift: ${clean(g.name, 70).replace(/^free\s+/i, "")}`),
  ];

  const build = (shown) => {
    const more = items.length - shown;
    const lines = [
      "Hello NAVEN, I'd like to order:",
      "",
      ...items.slice(0, shown).flatMap(itemLines),
    ];
    if (more > 0) {
      lines.push(`+ ${more} more item${more === 1 ? "" : "s"}${quoteRef ? ` (full list on ${quoteRef})` : ""}`);
    }
    lines.push("", `Total: ${nairaText(total)}`);
    if (name) lines.push(`Name: ${clean(name, 60)}`);
    if (phone) lines.push(`Phone: ${phone}`);
    if (email) lines.push(`Email: ${clean(email, 80)}`);
    if (quoteRef) lines.push(`Ref: ${quoteRef}`);
    return lines.join("\n");
  };

  let shown = Math.min(items.length, MAX_ITEMS);
  let text = build(shown);
  while (text.length > MAX_CHARS && shown > 1) {
    shown -= 1;
    text = build(shown);
  }
  return text;
}
