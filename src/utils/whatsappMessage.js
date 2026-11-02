import { SITE } from "../config/site.js";

/**
 * WhatsApp messages about products — the ONE place they're written.
 * Used by the product page ("Need help choosing?", Q&A, reviews) and
 * Send Cart to WhatsApp. Uses WhatsApp formatting (*bold*).
 *
 *   whatsappUrl(message)        → https://wa.me/<NAVEN number>?text=…
 *   productHelpMessage(product) → "Need help choosing?" text
 *   cartMessage({...})          → cart / quote text (≤ ~1,500 chars)
 */

const MAX_CHARS = 1500;
const MAX_ITEMS = 10;
const RULE = "──────────────";

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
 * Cart / quote message.
 *   items:    [{ name, sku, qty, unitPrice }]            paid lines, in cart order
 *   gifts:    [{ name, giftFor }]                        free gifts (giftFor = paid SKU)
 *   subtotal: number
 *   quoteRef, customerName, area ("Lekki, Lagos") — optional
 *
 * Lists up to 10 items; if the text would pass ~1,500 characters it
 * lists fewer. Anything left off is summed up as "+ N more items".
 */
export function cartMessage({ items, gifts = [], subtotal, quoteRef = null, customerName = "", area = "" }) {
  const giftsFor = new Map();
  for (const g of gifts) {
    if (!giftsFor.has(g.giftFor)) giftsFor.set(g.giftFor, []);
    giftsFor.get(g.giftFor).push(g);
  }

  const itemBlock = (item, n) => [
    `*${n}. ${clean(item.name)}*`,
    `   SKU: ${item.sku}`,
    `   Qty: ${item.qty} × ${nairaText(item.unitPrice)} = *${nairaText(item.unitPrice * item.qty)}*`,
    // Offer titles often start with "Free …"; don't print "Free gift: Free …".
    ...(giftsFor.get(item.sku) || []).map((g) => `   Free gift: ${clean(g.name, 70).replace(/^free\s+/i, "")}`),
  ].join("\n");

  const build = (shown) => {
    const more = items.length - shown;
    const lines = [
      "Hello NAVEN 👋",
      "",
      "I'd like to order the following:",
      "",
      items.slice(0, shown).map((item, i) => itemBlock(item, i + 1)).join("\n\n"),
    ];
    if (more > 0) {
      lines.push("", `+ ${more} more item${more === 1 ? "" : "s"}.${quoteRef ? ` Full list on quote ${quoteRef}.` : ""}`);
    }
    lines.push(
      RULE,
      `*Subtotal: ${nairaText(subtotal)}*`,
      "Delivery: to be confirmed",
      RULE,
    );
    if (quoteRef) lines.push(`Quote ref: ${quoteRef}`);
    if (customerName) lines.push(`Name: ${clean(customerName, 60)}`);
    if (area) lines.push(`Delivery area: ${clean(area, 80)}`);
    lines.push("", "Please confirm availability and delivery. Thank you.");
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
