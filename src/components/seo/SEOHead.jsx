import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { headTags } from "../../lib/seo/headTags.js";

/**
 * SEOHead — the page's <head> tags.
 *
 * Tags come from headTags() (src/lib/seo/headTags.js), the same
 * function the build-time prerender uses, so crawlers that don't run
 * JavaScript (WhatsApp, Facebook, X, LinkedIn) get exactly what the
 * app renders. Prerendered tags carry data-rh="true", so Helmet
 * replaces them instead of duplicating them.
 *
 * Props (all optional):
 *   title        → "<title> | NAVEN" (none → "NAVEN | The Premium Electronics")
 *   description  ~155 characters
 *   image        Open Graph image (absolute or site path)
 *   imageAlt     alt text for the share image
 *   url          canonical path (default: current path, query stripped)
 *   noindex      robots noindex (private / utility pages; no canonical)
 *   type         "website" | "product" | "article"
 *   price, availability ("instock" | "oos")   product pages
 *   jsonLd       array of schema.org objects
 *
 * Page metadata lives in src/lib/seo/pageMeta.js (STATIC_META,
 * productMeta, categoryMeta, brandMeta, homeMeta).
 */
export default function SEOHead(props) {
  const location = useLocation();
  const { title, metas, links, jsonLd } = headTags({ ...props, url: props.url || location.pathname });

  return (
    <Helmet>
      <title>{title}</title>
      {metas.map((m) => (
        m.name
          ? <meta key={`n:${m.name}`} name={m.name} content={m.content} />
          : <meta key={`p:${m.property}`} property={m.property} content={m.content} />
      ))}
      {links.map((l) => <link key={l.rel} rel={l.rel} href={l.href} />)}
      {jsonLd.map((data, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(data)}</script>
      ))}
    </Helmet>
  );
}
