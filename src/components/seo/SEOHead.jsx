import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { buildTitle, buildCanonical, DEFAULT_DESCRIPTION, DEFAULT_KEYWORDS, DEFAULT_OG_IMAGE, SITE_URL } from "../../lib/seo/defaults.js";

/**
 * SEOHead — universal meta tag component for all pages.
 *
 * Props (all optional — sensible defaults applied):
 *   title       — page title (will be formatted as "<title> — NAVEN")
 *   description — meta description (155-160 chars ideal)
 *   keywords    — meta keywords string (comma-separated)
 *   image       — Open Graph image URL (defaults to /og-default.png)
 *   url         — canonical URL (defaults to current path)
 *   noindex     — if true, adds <meta name="robots" content="noindex, nofollow">
 *   type        — OG type ("website" default, "article" for blog, "product" for products)
 *   jsonLd      — array of JSON-LD objects to inject as <script> tags
 *
 * Usage:
 *   <SEOHead
 *     title="New Arrivals"
 *     description="Fresh inventory from Scanfrost, Midea, Samsung and more"
 *     jsonLd={[organizationSchema()]}
 *   />
 */
export default function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  image = DEFAULT_OG_IMAGE,
  url,
  noindex = false,
  type = "website",
  jsonLd = [],
}) {
  const location = useLocation();
  const canonical = url || buildCanonical(location.pathname);
  const fullTitle = buildTitle(title);
  const ogImage = image && image.startsWith("http") ? image : `${SITE_URL}${image}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />

      {/* Robots directive */}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}

      {/* Open Graph (Facebook, LinkedIn, WhatsApp previews) */}
      <meta property="og:site_name" content="NAVEN" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_NG" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@mynavenhq" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD structured data (one <script> per object) */}
      {jsonLd.filter(Boolean).map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
}
