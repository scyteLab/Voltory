/**
 * headTags(meta) — the exact <head> tags for a page, as plain data.
 *
 * Rendered by SEOHead (React Helmet, in the browser) AND written into
 * the prerendered HTML by scripts/seo-build.mjs, so what WhatsApp /
 * Facebook / Google see without JavaScript is identical to what the
 * app shows. Pure: no browser APIs.
 */
import { buildCanonical, buildTitle, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_URL } from "./defaults.js";
import { SITE } from "../../config/site.js";

const AVAILABILITY = { instock: "in stock", oos: "out of stock" };

/**
 * meta: { title, description, url (path), image, imageAlt, noindex,
 *         type ("website" | "product" | "article"), price, availability,
 *         jsonLd: [] }
 * → { title, metas: [{ name|property, content }], links: [{ rel, href }], jsonLd: [] }
 */
export function headTags(meta = {}) {
  const title = buildTitle(meta.title);
  const description = meta.description || DEFAULT_DESCRIPTION;
  const canonical = buildCanonical(meta.url || "/");
  const image = meta.image ? (/^https?:/i.test(meta.image) ? meta.image : `${SITE_URL}${meta.image}`) : DEFAULT_OG_IMAGE;
  const isDefaultImage = image === DEFAULT_OG_IMAGE;
  const type = meta.type || "website";

  const metas = [
    { name: "description", content: description },
    { name: "robots", content: meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large" },
    { property: "og:site_name", content: SITE.name },
    { property: "og:type", content: type },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
    { property: "og:image", content: image },
    ...(isDefaultImage
      ? [{ property: "og:image:width", content: "1200" }, { property: "og:image:height", content: "630" }]
      : []),
    { property: "og:image:alt", content: meta.imageAlt || title },
    { property: "og:locale", content: "en_NG" },
    ...(type === "product" && meta.price
      ? [
          { property: "product:price:amount", content: String(meta.price) },
          { property: "product:price:currency", content: "NGN" },
          ...(AVAILABILITY[meta.availability] ? [{ property: "product:availability", content: AVAILABILITY[meta.availability] }] : []),
          { property: "product:condition", content: "new" },
        ]
      : []),
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:site", content: "@mynavenhq" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];

  return {
    title,
    metas,
    // A noindex page has no canonical (it isn't meant to be indexed).
    links: meta.noindex ? [] : [{ rel: "canonical", href: canonical }],
    jsonLd: (meta.jsonLd || []).filter(Boolean),
  };
}
