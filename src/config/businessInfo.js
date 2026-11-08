/**
 * businessInfo.js  —  NAVEN's legal / registration details
 *
 * Single source of truth for the business identity shown on
 * receipts, legal pages, the footer, SEO structured data and
 * customer emails. Don't hard-code any of this elsewhere.
 *
 * Source: CAC Business Name status report. NAVEN is a registered
 * BUSINESS NAME, not a limited company, so never write "Ltd" /
 * "Limited" / "RC" for it.
 *
 * No proprietor's personal details (name, phone, email, date of
 * birth) belong in this file or anywhere on the site.
 *
 * Plain data (no browser APIs): also imported by Netlify functions
 * via src/lib/emailTemplates.js. Standalone on purpose — site.js
 * reads legalName from here, so this file must not import site.js.
 */

export const BUSINESS_INFO = {
  // ---- Legal identity (CAC) ------------------------------------
  legalName:         "NAVEN Electronics Enterprises",  // CAC: NAVEN ELECTRONICS ENTERPRISES
  brandName:         "NAVEN",
  registrationType:  "Business Name",
  registrationLabel: "BN",
  registrationNo:    "9959219",
  registeredOn:      "2026-10-23",

  // ---- Registered address ---------------------------------------
  address: "7 Saliu Close, Ifako-Ijaiye, Lagos State, Nigeria",
  addressParts: {
    street:   "7 Saliu Close",
    locality: "Ifako-Ijaiye",
    region:   "Lagos State",
    country:  "NG",
  },

  // ---- Contact ----------------------------------------------------
  phone:        "+234 906 4998 654",
  phoneTelHref: "tel:+2349064998654",
  whatsapp:     "+234 906 4998 654",
  whatsappLink: "https://wa.me/2349064998654",
  email:        "support@mynaven.com",
  supportEmail: "support@mynaven.com",
  website:      "www.mynaven.com",
  websiteUrl:   "https://mynaven.com",

  // ---- Tax --------------------------------------------------------
  // Not issued yet: the TIN line is hidden while this is null.
  tin: null,
  // Not VAT-registered: every VAT line is hidden while false. If it
  // becomes true, prices are treated as VAT-inclusive at vatRate.
  vatRegistered: false,
  vatRate: 0.075,

  // ---- Brand ------------------------------------------------------
  taglinePrimary: "THE PREMIUM ELECTRONICS",
};

/** "BN 9959219" */
export const registrationDisplay =
  `${BUSINESS_INFO.registrationLabel} ${BUSINESS_INFO.registrationNo}`;

/** "NAVEN Electronics Enterprises · BN 9959219" */
export const legalNameWithReg = `${BUSINESS_INFO.legalName} · ${registrationDisplay}`;

/**
 * How the business is identified on legal pages:
 * "NAVEN Electronics Enterprises (Business Name No. BN 9959219),
 *  registered with the Corporate Affairs Commission, 7 Saliu Close,
 *  Ifako-Ijaiye, Lagos State, Nigeria."
 */
export const businessIdentity =
  `${BUSINESS_INFO.legalName} (${BUSINESS_INFO.registrationType} No. ${registrationDisplay}), `
  + `registered with the Corporate Affairs Commission, ${BUSINESS_INFO.address}.`;
