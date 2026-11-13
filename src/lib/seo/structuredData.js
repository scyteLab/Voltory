/**
 * JSON-LD structured data generators.
 *
 * These produce schema.org structured data that Google reads to show rich
 * snippets in search results (prices, ratings, breadcrumbs, product info).
 *
 * Returns plain JavaScript objects — the SEOHead component wraps them in
 * <script type="application/ld+json"> tags.
 */
import { SITE_URL, DEFAULT_OG_IMAGE } from "./defaults.js";
import { SITE } from "../../config/site.js";
import { BUSINESS_INFO } from "../../config/businessInfo.js";

/**
 * Organization schema — identifies NAVEN as a business entity.
 * Used on the homepage. Google uses this for the knowledge panel.
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE.name,
    "legalName": BUSINESS_INFO.legalName,
    "url": SITE_URL,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": BUSINESS_INFO.addressParts.street,
      "addressLocality": BUSINESS_INFO.addressParts.locality,
      "addressRegion": BUSINESS_INFO.addressParts.region,
      "addressCountry": BUSINESS_INFO.addressParts.country,
    },
    "logo": `${SITE_URL}/og-default.png`,
    "sameAs": [
      "https://web.facebook.com/mynavenhq/",
      "https://www.instagram.com/mynavenhq",
      "https://x.com/mynavenhq",
      "https://www.tiktok.com/@mynavenhq",
      "https://www.youtube.com/@mynavenhq",
      "https://www.linkedin.com/company/mynavenhq",
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": SITE.phone,
      "contactType": "customer service",
      "areaServed": "NG",
      "availableLanguage": ["en"],
    },
  };
}

/**
 * LocalBusiness schema — identifies NAVEN as a Nigerian business.
 * Used on About and Contact pages. Helps with local search.
 */
export function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "name": SITE.name,
    "image": `${SITE_URL}/og-default.png`,
    "url": SITE_URL,
    "telephone": SITE.phone,
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "NG",
      "addressLocality": "Lagos",
      "addressRegion": "Lagos State",
    },
    "priceRange": "₦₦",
  };
}

/**
 * Website schema with search action — enables the sitelinks search box in Google.
 * Used on the homepage.
 */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": SITE.name,
    "url": SITE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${SITE_URL}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Product schema — rich snippet with price, availability, ratings.
 * Used on Product pages. Google uses this for product rich cards.
 *
 * Ratings are only ever real, APPROVED reviews:
 *   reviewData.summary  { average, total }  from product_review_summary
 *   reviewData.reviews  up to 5 approved reviews (author "First L.")
 * aggregateRating is added only when at least 1 approved review
 * exists; nothing is added otherwise.
 */
export function productSchema(product, reviewData = {}) {
  if (!product) return null;
  const url = `${SITE_URL}/product/${product.slug}`;
  const image = product.image ? (product.image.startsWith("http") ? product.image : `${SITE_URL}${product.image}`) : DEFAULT_OG_IMAGE;
  const availability = product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": image,
    "description": product.description || `${product.name} — available at ${SITE.name}, with nationwide delivery across Nigeria.`,
    "sku": product.sku,
    "brand": {
      "@type": "Brand",
      "name": product.brand || "Unbranded",
    },
    "offers": {
      "@type": "Offer",
      "url": url,
      "priceCurrency": "NGN",
      "price": product.price,
      "availability": availability,
      "seller": {
        "@type": "Organization",
        "name": SITE.name,
      },
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

/**
 * BreadcrumbList schema — shows breadcrumb trail in Google search results.
 * Pass an array of { name, url } objects in display order.
 */
export function breadcrumbSchema(items) {
  if (!items || items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}

/**
 * ItemList schema — used on category and brand pages that list products.
 * Pass products and the page URL.
 */
export function itemListSchema(products, pageUrl) {
  if (!products || products.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "url": pageUrl.startsWith("http") ? pageUrl : `${SITE_URL}${pageUrl}`,
    "numberOfItems": products.length,
    "itemListElement": products.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": `${SITE_URL}/product/${p.slug}`,
      "name": p.name,
    })),
  };
}
