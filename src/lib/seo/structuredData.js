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

/**
 * Organization schema — identifies NAVEN as a business entity.
 * Used on the homepage. Google uses this for the knowledge panel.
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": SITE.name,
    "legalName": SITE.legalName,
    "url": SITE_URL,
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
 */
export function productSchema(product) {
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

  if (product.rating && product.reviews) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      "ratingValue": product.rating,
      "reviewCount": product.reviews,
    };
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
