/**
 * SEO defaults — fallback templates when a page doesn't provide custom values.
 * Keeps meta titles consistent across the site.
 *
 * The SITE_URL is used for canonical URLs, Open Graph URLs, and sitemap generation.
 * Change this constant if the domain changes.
 */
import { SITE } from "../../config/site.js";

export const SITE_URL = "https://mynaven.com";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`;

/**
 * Build a page title in the standard "<Page Title> — NAVEN" format.
 */
export function buildTitle(pageTitle) {
  if (!pageTitle) return SITE.name;
  return `${pageTitle} — ${SITE.name}`;
}

/**
 * Build a canonical URL from a path.
 * Strips trailing slashes except for the homepage.
 */
export function buildCanonical(path = "/") {
  const cleanPath = path === "/" ? "/" : path.replace(/\/+$/, "");
  return `${SITE_URL}${cleanPath}`;
}

/**
 * Default meta description for the whole site.
 * Used when a page doesn't provide its own.
 */
export const DEFAULT_DESCRIPTION =
  "NAVEN — The Premium Electronics. Shop fridges, air conditioners, TVs, " +
  "washing machines, and premium home appliances from Scanfrost, Midea, " +
  "Samsung, Sony, Panasonic, and Kenwood. Nationwide delivery across Nigeria " +
  "with pay-on-delivery available.";

/**
 * Default keywords (used sparingly — meta keywords is largely ignored by Google
 * but still used by some Nigerian search engines and social crawlers).
 */
export const DEFAULT_KEYWORDS = [
  "home appliances Nigeria",
  "online appliance store Lagos",
  "buy fridge Nigeria",
  "buy air conditioner Lagos",
  "Scanfrost",
  "Midea",
  "Samsung Nigeria",
  "Sony Nigeria",
  "Panasonic Nigeria",
  "Kenwood Nigeria",
].join(", ");
