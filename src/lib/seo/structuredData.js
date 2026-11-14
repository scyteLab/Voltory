/**
 * JSON-LD structured data generators (schema.org), checked against
 * Google's Rich Results requirements:
 *   Organization  — name, url, logo (≥112px), contact
 *   WebSite       — SearchAction (sitelinks search box)
 *   Product       — name, image, offers{price, priceCurrency,
 *                   availability, itemCondition, seller}; ratings ONLY
 *                   from approved reviews
 *   BreadcrumbList, ItemList
 *
 * Pure (no browser APIs): used by the React pages AND by the build-time
 * prerender (scripts/seo-build.mjs), so both always emit the same data.
 * Nothing here is invented: every value comes from the catalogue, the
 * business info file or approved reviews.
 */
import { SITE_URL } from "./defaults.js";
import { SITE } from "../../config/site.js";
import { BUSINESS_INFO } from "../../config/businessInfo.js";

/** Same profiles as the footer. */
export const SOCIAL_PROFILES = [
  "https://web.facebook.com/mynavenhq/",
  "https://www.instagram.com/mynavenhq",
  "https://x.com/mynavenhq",
  "https://www.tiktok.com/@mynavenhq",
  "https://www.youtube.com/@mynavenhq",
  "https://www.linkedin.com/company/mynavenhq",
];

const ORG_ID = `${SITE_URL}/#organization`;

/** Absolute URL for an image or path; null for empty input. */
export function absoluteUrl(src) {
  if (!src) return null;
  const s = String(src).trim();
  if (/^https?:\/\//i.test(s)) return s;
  return `${SITE_URL}${s.startsWith("/") ? "" : "/"}${s}`;
}

/** Plain text for descriptions (strips tags, collapses whitespace). */
export function plainText(v) {
  return String(v || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Organization — NAVEN as a business (homepage). Legal name is the
 * registered Business Name (no "Ltd").
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    "name": SITE.name,
    "legalName": BUSINESS_INFO.legalName,
    "url": SITE_URL,
    "logo": {
      "@type": "ImageObject",
      "url": `${SITE_URL}/android-chrome-512x512.png`,
      "width": 512,
      "height": 512,
    },
    "image": `${SITE_URL}/og-default.png`,
    "email": BUSINESS_INFO.supportEmail,
    "telephone": BUSINESS_INFO.phone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": BUSINESS_INFO.addressParts.street,
      "addressLocality": BUSINESS_INFO.addressParts.locality,
      "addressRegion": BUSINESS_INFO.addressParts.region,
      "addressCountry": BUSINESS_INFO.addressParts.country,
    },
    "sameAs": SOCIAL_PROFILES,
    "contactPoint": [{
      "@type": "ContactPoint",
      "telephone": BUSINESS_INFO.phone,
      "email": BUSINESS_INFO.supportEmail,
      "contactType": "customer service",
      "areaServed": "NG",
      "availableLanguage": ["en"],
    }],
  };
}

/** Store — used on About / Contact for local search. */
export function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "name": SITE.name,
    "legalName": BUSINESS_INFO.legalName,
    "image": `${SITE_URL}/og-default.png`,
    "url": SITE_URL,
    "telephone": BUSINESS_INFO.phone,
    "email": BUSINESS_INFO.supportEmail,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": BUSINESS_INFO.addressParts.street,
      "addressLocality": BUSINESS_INFO.addressParts.locality,
      "addressRegion": BUSINESS_INFO.addressParts.region,
      "addressCountry": BUSINESS_INFO.addressParts.country,
    },
  };
}

/** WebSite with SearchAction (homepage). */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    "name": SITE.name,
    "url": SITE_URL,
    "publisher": { "@id": ORG_ID },
    "potentialAction": {
      "@type": "SearchAction",
      "target": { "@type": "EntryPoint", "urlTemplate": `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Main image + uploaded gallery, absolute, de-duplicated. */
export function productImageUrls(product) {
  const list = [product?.image, ...(Array.isArray(product?.gallery) ? product.gallery : [])]
    .map(absoluteUrl)
    .filter(Boolean);
  return [...new Set(list)];
}

/**
 * Product — price, availability, condition and seller.
 *
 * Ratings are only ever real, APPROVED reviews:
 *   reviewData.summary  { average, total }  from product_review_summary
 *   reviewData.reviews  up to 5 approved reviews (author "First L.")
 * Without a summary, products.rating / products.reviews are used
 * (the database computes those from approved reviews only).
 * aggregateRating is added only when at least 1 approved review exists.
 *
 * opts.brandName  canonical brand name (defaults to product.brand)
 * opts.category   { label } for the product category
 */
export function productSchema(product, reviewData = {}, opts = {}) {
  if (!product) return null;
  const url = `${SITE_URL}/product/${product.slug}`;
  const images = productImageUrls(product);
  const inStock = Number(product.stock) > 0;
  const brandName = opts.brandName || product.brand;
  const description = plainText(product.description) ||
    `${product.name}${brandName ? ` by ${brandName}` : ""}, sold by ${SITE.name} with delivery across Nigeria.`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    "name": product.name,
    "url": url,
    "description": description.slice(0, 5000),
    "sku": product.sku,
    ...(product.model ? { "mpn": product.model } : {}),
    ...(images.length ? { "image": images } : {}),
    ...(brandName ? { "brand": { "@type": "Brand", "name": brandName } } : {}),
    ...(opts.category?.label ? { "category": opts.category.label } : {}),
    "offers": {
      "@type": "Offer",
      "url": url,
      "priceCurrency": "NGN",
      "price": String(Number(product.price)),
      "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      "itemCondition": "https://schema.org/NewCondition",
      "seller": { "@type": "Organization", "name": SITE.name, "@id": ORG_ID },
    },
  };

  const summary = reviewData.summary;
  const count = summary ? Number(summary.total) || 0 : Number(product.reviews) || 0;
  const average = summary ? Number(summary.average) || 0 : Number(product.rating) || 0;
  if (count >= 1 && average > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": average.toFixed(1),
      "reviewCount": count,
      "bestRating": 5,
      "worstRating": 1,
    };
    const items = (reviewData.reviews || []).filter((r) => r && r.rating >= 1).slice(0, 5);
    if (items.length) {
      schema.review = items.map((r) => ({
        "@type": "Review",
        "author": { "@type": "Person", "name": r.author },
        "datePublished": String(r.createdAt || "").slice(0, 10),
        "reviewRating": { "@type": "Rating", "ratingValue": r.rating, "bestRating": 5, "worstRating": 1 },
        ...(r.title ? { "name": r.title } : {}),
        ...(r.body ? { "reviewBody": r.body } : {}),
      }));
    }
  }

  return schema;
}

/** BreadcrumbList — pass [{ name, url }] in display order. */
export function breadcrumbSchema(items) {
  if (!items || items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": absoluteUrl(item.url),
    })),
  };
}

/** ItemList — the products on a category or brand page (first 20). */
export function itemListSchema(products, pageUrl) {
  if (!products || products.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "url": absoluteUrl(pageUrl),
    "numberOfItems": products.length,
    "itemListElement": products.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${SITE_URL}/product/${p.slug}`,
      "name": p.name,
    })),
  };
}
