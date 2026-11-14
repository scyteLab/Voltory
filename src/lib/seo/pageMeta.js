/**
 * Page metadata — ONE source for titles, descriptions, images and
 * JSON-LD, used by the React pages (SEOHead) and by the build-time
 * prerender (scripts/seo-build.mjs). Pure: no browser APIs.
 *
 * Everything is built from real catalogue data; nothing is invented.
 */
import { SITE } from "../../config/site.js";
import { DEFAULT_OG_IMAGE } from "./defaults.js";
import {
  absoluteUrl, breadcrumbSchema, itemListSchema, organizationSchema, plainText, productSchema, websiteSchema,
} from "./structuredData.js";

const naira = (n) => `₦${Math.round(Number(n) || 0).toLocaleString("en-NG")}`;

/** Trim to ~155 characters on a word boundary. */
export function metaDescription(text, max = 155) {
  const s = plainText(text);
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const atSpace = cut.lastIndexOf(" ");
  return `${(atSpace > max * 0.6 ? cut.slice(0, atSpace) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}

/* ------------------------------------------------------------------ */
/*  Static pages                                                       */
/* ------------------------------------------------------------------ */

export const HOME_DESCRIPTION =
  "NAVEN — The Premium Electronics. Shop fridges, air conditioners, TVs, washing machines and home appliances from top brands, delivered across Nigeria.";

/** path → { title, description }. Pages spread these into SEOHead. */
export const STATIC_META = {
  "/categories": {
    title: "All Categories",
    description: "Browse all appliance categories at NAVEN — fridges, air conditioners, TVs, washing machines, kitchen and small appliances.",
  },
  "/brands": {
    title: "Our Brand Partners",
    description: "The brands we stock at NAVEN — Scanfrost, Midea, Samsung, Sony, Panasonic, Kenwood and more. Shop premium Nigerian appliances.",
  },
  "/new": {
    title: "New Arrivals",
    description: "The freshest in-stock arrivals at NAVEN. Just-added products and recently restocked favourites across every category.",
  },
  "/best-sellers": {
    title: "Best Sellers",
    description: "The most popular appliances on NAVEN. See what Nigerian customers are buying right now.",
  },
  "/deals": {
    title: "Deals & Offers",
    description: "Current deals on appliances at NAVEN. Discounts on fridges, ACs, TVs, washing machines — refreshed regularly.",
  },
  "/compare": {
    title: "Compare Products",
    description: "Compare appliances side-by-side at NAVEN. Make informed buying decisions on fridges, ACs, TVs, and more.",
  },
  "/help": {
    title: "Help Center",
    description: "Help Center at NAVEN. FAQs on orders, delivery, returns, warranty, and after-sales support.",
  },
  "/contact": {
    title: "Contact Us",
    description: "Contact NAVEN — phone, WhatsApp, email. We're here to help with orders, product questions, and after-sales support.",
  },
  "/services/installation": {
    title: "Installation Services",
    description: "Professional appliance installation across Lagos and Nigeria. Air conditioners, washing machines, cookers, and more.",
  },
  "/about": {
    title: "About",
    description: "Learn about NAVEN, Nigeria's premium electronics retailer. Our mission, our brands, and our commitment to quality home appliances.",
  },
  "/careers": {
    title: "Careers",
    description: "Join the NAVEN team. Open roles in Lagos, Nigeria across tech, operations, and customer service.",
  },
  "/blog": {
    title: "Blog",
    description: "Appliance buying guides, product reviews, and tips from NAVEN — Nigeria's premium electronics store.",
  },
  "/affiliate": {
    title: "Affiliate Program",
    description: "Join the NAVEN affiliate program. Earn commission by referring customers to premium Nigerian home appliances.",
  },
  "/reviews-guidelines": {
    title: "Review Guidelines",
    description: "How to write helpful product reviews on NAVEN. Our community guidelines for honest, useful feedback.",
  },
  "/terms": {
    title: "Terms & Conditions",
    description: "NAVEN's Terms & Conditions, issued under the Federal Competition and Consumer Protection Act 2018 and the Nigeria Data Protection Act 2023 (NDPA).",
  },
  "/privacy": {
    title: "Privacy Policy",
    description: "How NAVEN collects, uses, and protects your personal data under the Nigeria Data Protection Act 2023 (NDPA).",
  },
  "/returns": {
    title: "Returns & Refunds",
    description: "Return and refund policy at NAVEN — aligned with the Federal Competition and Consumer Protection Act 2018.",
  },
};

export function homeMeta() {
  return {
    title: null,                       // → "NAVEN | The Premium Electronics"
    description: HOME_DESCRIPTION,
    url: "/",
    jsonLd: [organizationSchema(), websiteSchema()],
  };
}

/* ------------------------------------------------------------------ */
/*  Product                                                            */
/* ------------------------------------------------------------------ */

/**
 * productMeta(product, { brandName, category, reviewData })
 *   title        "Product Name | Brand"   (SEOHead adds "| NAVEN")
 *   description  from the product's own description (~155 chars)
 */
export function productMeta(product, { brandName, category, reviewData } = {}) {
  const brand = brandName || product.brand || "";
  const inStock = Number(product.stock) > 0;
  const base = plainText(product.description);
  const tail = `${naira(product.price)}${inStock ? "" : " (out of stock)"} at ${SITE.name}, delivered across Nigeria.`;
  const description = metaDescription(
    base.length >= 110 ? base : [base || `${product.name}${brand ? ` by ${brand}` : ""}.`, tail].join(" "),
  );
  const url = `/product/${product.slug}`;
  const image = absoluteUrl(product.image) || DEFAULT_OG_IMAGE;
  const crumbs = [{ name: "Home", url: "/" }];
  if (category?.id) crumbs.push({ name: category.label || category.id, url: `/category/${category.id}` });
  crumbs.push({ name: product.name, url });

  return {
    title: brand ? `${product.name} | ${brand}` : product.name,
    description,
    url,
    image,
    imageAlt: [product.name, brand].filter(Boolean).join(" — "),
    type: "product",
    price: Number(product.price) || null,
    availability: inStock ? "instock" : "oos",
    jsonLd: [
      productSchema(product, reviewData || {}, { brandName: brand, category }),
      breadcrumbSchema(crumbs),
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Category / brand                                                   */
/* ------------------------------------------------------------------ */

function topBrands(products, n = 4) {
  const tally = new Map();
  for (const p of products) if (p.brand) tally.set(p.brand, (tally.get(p.brand) || 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([b]) => b);
}

/**
 * categoryMeta(category, products, { brandFilter })
 * products = the ACTIVE products in this category (brand names already
 * canonical). brandFilter = one selected brand name (Category page's
 * ?brand=) — title/description follow it; the canonical never does.
 */
export function categoryMeta(category, products = [], { brandFilter } = {}) {
  const label = category.label || category.id;
  const url = `/category/${category.id}`;
  const shown = brandFilter ? products.filter((p) => p.brand === brandFilter) : products;
  const brands = topBrands(products);
  const description = brandFilter
    ? metaDescription(`Shop ${brandFilter} ${label.toLowerCase()} at ${SITE.name}: ${shown.length} genuine product${shown.length === 1 ? "" : "s"} with manufacturer warranty and delivery across Nigeria.`)
    : metaDescription(`Shop ${label.toLowerCase()} at ${SITE.name}: ${products.length} product${products.length === 1 ? "" : "s"}${brands.length ? ` from ${brands.join(", ")}` : ""}. Manufacturer warranty and delivery across Nigeria.`);
  return {
    title: brandFilter ? `${brandFilter} ${label}` : label,
    description,
    url,
    jsonLd: [
      breadcrumbSchema([{ name: "Home", url: "/" }, { name: "Categories", url: "/categories" }, { name: label, url }]),
      itemListSchema(shown, url),
    ],
  };
}

/** brandMeta(brand, products) — products = this brand's active products. */
export function brandMeta(brand, products = []) {
  const url = `/brand/${brand.id}`;
  const cats = [...new Set(products.map((p) => p.categoryLabel).filter(Boolean))].slice(0, 4);
  return {
    title: `${brand.name} Appliances`,
    description: metaDescription(`Shop ${brand.name} at ${SITE.name}: ${products.length} product${products.length === 1 ? "" : "s"}${cats.length ? ` including ${cats.join(", ").toLowerCase()}` : ""}. Manufacturer warranty and delivery across Nigeria.`),
    url,
    jsonLd: [
      breadcrumbSchema([{ name: "Home", url: "/" }, { name: "Brands", url: "/brands" }, { name: brand.name, url }]),
      itemListSchema(products, url),
    ],
  };
}
