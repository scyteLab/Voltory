/**
 * ============================================================
 *  SITE CONFIGURATION — single source of truth for branding.
 *  To rebrand the entire site (name, contacts, themes, links),
 *  edit THIS file only. No component hard-codes any of this.
 * ============================================================
 */

export const SITE = {
  // ---- Identity (edit these to rename the business) ----
  name: "NAVEN",
  legalName: "NAVEN Electronics Ltd",
  tagline: "Life, Better Equipped.",
  footerPromise: "Life, Better Equipped.",
  copyrightYear: 2026,

  // Logo: index of the letter replaced by the bolt icon (the "O" in V⚡LTORY).
  // Set to -1 to show the bolt before the name instead (works for any rename).
  logoBoltIndex: -1,

  // ---- Contact ----
  phone: "0700 888 6658",
  supportEmail: "support@mynaven.com",
  whatsapp: "+234 803 888 6658",
  whatsappLink: "https://wa.me/2348038886658",

  // ---- Commerce ----
  currency: "NGN",
  currencySymbol: "₦",
  freeDeliveryOver: 150000,
  installationFee: 25000,
  welcomeCoupon: { code: "WELCOME10", percent: 10 },

  // ---- Top utility bar (right side links) ----
  topbarLinks: [
    { icon: "Truck", label: "Track Order", to: "/track-order" },
    { icon: "LifeBuoy", label: "Help Center", to: "/help" },
    { icon: "Users", label: "Become an Affiliate", to: "/affiliate" },
  ],

  // ---- Main navigation row (under header) ----
  mainNav: [
    { label: "Home", to: "/" },
    { label: "Brands", to: "/brands" },
    { label: "Deals", to: "/deals", highlight: true },
    { label: "New Arrivals", to: "/new" },
    { label: "Best Sellers", to: "/best-sellers" },
    { label: "Installation Services", to: "/services/installation" },
    { label: "Blog", to: "/blog" },
  ],

  // ---- Trust strip (six columns, new layout) ----
  trustPoints: [
    { icon: "ShieldCheck", title: "100% Original Products", text: "Sourced from authorized distributors." },
    { icon: "FileBadge", title: "Official Warranty", text: "Covered by brand warranty." },
    { icon: "CreditCard", title: "Secure Payments", text: "Pay online or bank transfer." },
    { icon: "Truck", title: "Fast & Reliable Delivery", text: "Delivery across Nigeria with care." },
    { icon: "Wrench", title: "Professional Installation", text: "Expert installation for eligible products." },
    { icon: "Headphones", title: "After-sales Support", text: "We're here before & after your purchase." },
  ],

  // ---- Bottom utility strip (above footer) ----
  bottomBenefits: [
    { icon: "Lock", title: "Secure Payments", text: "Your payments are safe with us." },
    { icon: "Repeat", title: "Easy Returns", text: "7-day return policy for eligible items." },
    { icon: "Tag", title: "Price Match Guarantee", text: "Find it cheaper? We'll match the price." },
    { icon: "Wallet", title: "Buy Now, Pay Later", text: "Split your payments with ease." },
  ],

  // ---- App promo ----
  app: {
    headline: "NAVEN in your pocket — soon",
    subhead: "Order, track and chat with us from one screen. Get notified the day our app drops.",
    funnyPopup: {
      title: "Ah ahn, na so we go take rush am?",
      message: "Our app dey come — e never ready o. Make we no go put rubbish for Play Store, our pikin must shine. For now, the website dey work scatter on your phone — try am.",
      button: "Okay na, I go use the website",
    },
  },

  // ---- Themes (admin-controlled; customers cannot change this) ----
  defaultTheme: "navy",
  themes: [
    { id: "navy", label: "NAVEN Navy", note: "Electric & trusted — the default.", swatches: ["#0A1C3A", "#1D4ED8", "#F5A623"] },
    { id: "green", label: "Market Green", note: "Fresh & Nigerian — distinct from every competitor.", swatches: ["#06251E", "#0A5C49", "#F2A91E"] },
    { id: "purple", label: "Royal Purple", note: "Premium & bold — for campaign seasons.", swatches: ["#1E1038", "#6D28D9", "#F5A623"] },
  ],

  // ---- Footer link columns ----
  footerColumns: [
    { title: "Shop", links: ["All Categories", "Bestsellers", "New Arrivals", "Deals & Offers", "Clearance Sale", "Installation Services"] },
    { title: "Customer Care", links: ["Help Center", "Track Your Order", "Returns & Refunds", "Warranty Information", "Review Guidelines", "Contact Us", "FAQs"] },
    { title: "About", links: ["About Us", "Our Brands", "Blog", "Careers", "Terms & Conditions", "Privacy Policy"] },
  ],

  footerBadges: ["Secure Payments", "Pay on Delivery", "Nationwide Delivery"],
};

/** Derived helpers — keep components dumb. */
export const wordmarkParts = () => {
  const n = SITE.name.toUpperCase();
  const i = SITE.logoBoltIndex;
  if (i < 0 || i >= n.length) return { pre: "", post: n, boltFirst: true };
  return { pre: n.slice(0, i), post: n.slice(i + 1), boltFirst: false };
};

export const pageTitle = (suffix) =>
  suffix ? `${suffix} — ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`;