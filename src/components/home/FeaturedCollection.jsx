import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { fetchCollectionBySlug, fetchActiveCollections } from "../../lib/collectionsClient.js";
import ProductCard from "../product/ProductCard.jsx";

/**
 * FeaturedCollection  —  homepage widget
 *
 * Rendered by HomeRenderer for site_sections rows with
 * kind='featured_collection'. Accepts config prop from the section:
 *
 *   config: {
 *     slug:  "ramadan-essentials",  — which collection to show
 *     limit: 8,                     — max products (default 8)
 *   }
 *
 * If no slug is configured, falls back to the FIRST active
 * collection (alphabetical). Silently renders nothing if there
 * are no active collections at all — safer than an empty
 * "featured" section during initial setup.
 */
export default function FeaturedCollection({ config = {} }) {
  const [collection, setCollection] = useState(null);
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);

  const limit = Number(config.limit) || 8;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      /* Determine which collection to show */
      let slug = config.slug;
      if (!slug) {
        /* Fallback: first active collection */
        const listRes = await fetchActiveCollections();
        if (listRes.ok && listRes.data.length > 0) {
          slug = listRes.data[0].slug;
        }
      }

      if (!slug) {
        if (!cancelled) { setLoading(false); }
        return;
      }

      const res = await fetchCollectionBySlug(slug);
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setCollection(res.data.collection);
        setProducts(res.data.products.slice(0, limit));
      }
    })();
    return () => { cancelled = true; };
  }, [config.slug, limit]);

  /* Silently skip during load OR if nothing to show — don't
     flash an empty section on the homepage. */
  if (loading || !collection || products.length === 0) return null;

  return (
    <section className="fc-section">
      <header className="fc-section__head">
        <div>
          <h2>{collection.name}</h2>
          {collection.description && (
            <p>{collection.description}</p>
          )}
        </div>
        <Link to={`/collection/${collection.slug}`} className="fc-section__viewall">
          View all <ArrowRight size={14} />
        </Link>
      </header>

      <div className="fc-section__grid">
        {products.map((p) => (
          <ProductCard key={p.sku} product={p} />
        ))}
      </div>
    </section>
  );
}