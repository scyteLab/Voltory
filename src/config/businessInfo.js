import { SITE } from "./site.js";

/**
 * businessInfo.js  \u2014  legal business details for receipts
 *
 * These values appear on every receipt (customer-facing and
 * admin-viewable). For FIRS-compliant Nigerian invoicing you
 * need: legal name, TIN, RC number, registered address, VAT
 * registration status.
 *
 * IMPORTANT: replace every TODO below with real values BEFORE
 * issuing receipts to real customers. Grep for "TODO(business)"
 * to find them:
 *
 *     grep -rn "TODO(business)" src/
 *
 * Wrong values on receipts can create real accounting and
 * regulatory problems, so this file is the single source of
 * truth \u2014 don't hardcode business info anywhere else.
 */

export const BUSINESS_INFO = {
  // ---- Legal identity -----------------------------------------

  // TODO(business): replace with the exact legal entity name as
  // registered with CAC (Corporate Affairs Commission).
  legalName: "NAVEN Electronics Ltd",

  // Consumer-facing brand \u2014 shown prominently on the receipt.
  brandName: SITE.name,

  // TODO(business): CAC RC number. Format is usually "RC-XXXXXXX"
  // or just "RC XXXXXXX". Required alongside TIN.
  rcNumber: "RC-XXXXXXX",

  // TODO(business): Tax Identification Number issued by FIRS.
  // 14 digits, hyphen-separated: NNNNNNNN-NNNN
  tin: "PLACEHOLDER-TIN",

  // TODO(business): are you VAT-registered with FIRS?
  // If yes, receipts must show the VAT breakdown.
  vatRegistered: true,

  // ---- Address ------------------------------------------------

  // TODO(business): registered business address as filed with CAC.
  address: {
    line1: "TODO update registered address line 1",
    line2: "",
    city:  "Lagos",
    state: "Lagos",
    country: "Nigeria",
  },

  // ---- Contact ------------------------------------------------
  // Reuses SITE config so a single change updates everywhere.

  phone:        SITE.phone,
  whatsapp:     SITE.whatsapp,
  whatsappLink: SITE.whatsappLink,
  supportEmail: SITE.supportEmail,
  website:      "https://mynaven.com",

  // ---- Tax config ---------------------------------------------

  // Nigerian standard VAT rate (7.5%). Stored per-order at issue
  // time (see orders.vat_rate) so historical receipts stay right
  // if the rate changes in future.
  vatRate: 0.075,

  // Are prices already VAT-inclusive?
  // true  \u2192 \u20A6100 shown includes \u20A66.98 VAT
  // false \u2192 \u20A6100 shown is base, VAT added at checkout
  vatInclusive: true,
};

/**
 * Compact formatted business address for the receipt header.
 * Skips blank lines cleanly.
 */
export function formatBusinessAddress() {
  const a = BUSINESS_INFO.address;
  return [a.line1, a.line2, `${a.city}, ${a.state}`, a.country]
    .filter(Boolean)
    .join("\n");
}