/**
 * ============================================================
 *  BRAND PAGES CONFIG
 *  Per-brand storefront content — tagline, description, hero
 *  color, partnership tier. The admin will later edit these
 *  through the Brand Settings page; the front-end doesn't change.
 *
 *  Tiers:
 *    "official"  — direct distribution relationship (Scanfrost)
 *    "featured"  — prominent stock partner (Midea, Samsung)
 *    "standard"  — catalog brand
 * ============================================================
 */

export const BRAND_PAGES = {
  scanfrost: {
    tier: "official",
    tagline: "Cooling, cooking & power appliances — backed by official warranty and after-sales support.",
    description:
      "Scanfrost is a Nigerian household name. NAVEN is an official distributor, offering the full range with manufacturer warranty, professional installation, and dedicated after-sales support across the country.",
    heroColor: "#0a2540",
    accent: "#dc2626",
  },
  midea: {
    tier: "featured",
    tagline: "Globally trusted appliances for modern Nigerian homes.",
    description:
      "Midea is one of the world's largest appliance manufacturers, known for inverter ACs, energy-efficient washing machines, and reliable kitchen appliances. Genuine stock, full warranty.",
    heroColor: "#003478",
    accent: "#0078d4",
  },
  samsung: {
    tier: "featured",
    tagline: "Premium electronics with class-leading quality and innovation.",
    description:
      "Samsung is a global leader in televisions, refrigerators and home appliances. Every Samsung product on NAVEN comes with full Samsung Nigeria warranty.",
    heroColor: "#0a0a0a",
    accent: "#1428a0",
  },
  sony: {
    tier: "standard",
    tagline: "Audio and visual excellence — crafted by Sony.",
    description:
      "Renowned for televisions and audio equipment. NAVEN stocks select Sony lines with full manufacturer warranty.",
    heroColor: "#000000",
    accent: "#000000",
  },
  kenwood: {
    tier: "standard",
    tagline: "Kitchen confidence — trusted appliances for everyday cooking.",
    description:
      "Blenders, juicers, mixers and small kitchen appliances. Practical, reliable, and backed by Kenwood's heritage.",
    heroColor: "#7a1a1a",
    accent: "#c81e1e",
  },
  panasonic: {
    tier: "standard",
    tagline: "Reliable Japanese engineering for the long haul.",
    description:
      "Panasonic is a Japanese electronics leader, known for energy-efficient ACs and dependable kitchen equipment.",
    heroColor: "#0a3d8f",
    accent: "#0f47a1",
  },
  lg: {
    tier: "standard",
    tagline: "Life's Good — innovation for the modern home.",
    description:
      "Dual Inverter ACs, side-by-side refrigerators, and premium TVs. NAVEN carries select LG lines with official warranty.",
    heroColor: "#a50034",
    accent: "#a50034",
  },
  hisense: {
    tier: "standard",
    tagline: "Smart electronics at the right price.",
    description:
      "Hisense has become a value-leader in TVs and large appliances across Nigeria. Quality engineering, sensible prices, full warranty.",
    heroColor: "#00a651",
    accent: "#00a651",
  },
  binatone: {
    tier: "standard",
    tagline: "Power protection and home essentials.",
    description:
      "Stabilizers, UPS systems and home essentials. The reliable choice for protecting your appliances.",
    heroColor: "#1a4d2e",
    accent: "#0a5c49",
  },
};

/** Tier metadata used by the UI — keep dumb components dumb. */
export const TIER_META = {
  official: {
    label: "Official Store",
    badgeClass: "btier--official",
  },
  featured: {
    label: "Featured Partner",
    badgeClass: "btier--featured",
  },
  standard: {
    label: null,
    badgeClass: null,
  },
};

export function brandPage(id) {
  return BRAND_PAGES[id] || null;
}