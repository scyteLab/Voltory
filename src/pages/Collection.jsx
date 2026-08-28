import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Home as HomeIcon, LayoutGrid } from "lucide-react";
import { fetchCollectionBySlug } from "../lib/collectionsClient.js";
import { SITE } from "../config/site.js";
import ProductCard from "../components/product/ProductCard.jsx";

/**
 * Collection — /collection/:slug
 *
 * Customer-facing landing page for a curated collection.
 * Renders banner + name + description + product grid.
 * Handles: not found (invalid slug or inactive), loading,
 * empty (collection has no products).
 *
 * ProductCard is reused from the existing storefront so grids
 * look identical to category/brand pages.
 */
export default function Collection() {
  const { slug } = useParams();

  const [collection, setCollection] = useState(null);
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await fetchCollectionBySlug(slug);
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) { setError(res.error); return; }
      setCollection(res.data.collection);
      setProducts(res.data.products);
    })();
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!collection) return;
    const prev = document.title;
    document.title = `${collection.name} — ${SITE.name}`;
    return () => { document.title = prev; };
  }, [collection]);

  /* Loading state */
  if (loading) {
    return (
      <main className="wrap">
        <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--mut)" }}>
          Loading collection…
        </div>
      </main>
    );
  }

  /* Not found */
  if (error || !collection) {
    return (
      <main className="wrap">
        <div style={{ padding: "80px 20px", textAlign: "center" }}>
          <LayoutGrid size={40} style={{ opacity: 0.4, marginBottom: 12 }} />
          <h1 style={{ margin: "0 0 8px" }}>Collection not found</h1>
          <p style={{ color: "var(--mut)", marginBottom: 24 }}>
            {error || "This collection doesn't exist or isn't currently active."}
          </p>
          <Link to="/" className="btn-shop">
            <HomeIcon size={14} /> Back to homepage
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* ---- Banner ---- */}
      {collection.banner_image && (
        <div className="collection-banner">
          <img src={collection.banner_image} alt={collection.name} />
        </div>
      )}

      <main className="wrap collection-page">
        <nav className="crumb" aria-label="Breadcrumb">
          <Link to="/"><HomeIcon size={13} /> Home</Link>
          <ChevronRight size={12} />
          <span>Collections</span>
          <ChevronRight size={12} />
          <span>{collection.name}</span>
        </nav>

        <header className="collection-head">
          <h1>{collection.name}</h1>
          {collection.description && (
            <p className="collection-head__desc">{collection.description}</p>
          )}
          <p className="collection-head__count">
            {products.length} product{products.length === 1 ? "" : "s"}
          </p>
        </header>

        {products.length === 0 ? (
          <div className="collection-empty">
            <LayoutGrid size={32} strokeWidth={1.4} />
            <b>No products in this collection yet.</b>
            <p>Check back soon — our team is curating this selection.</p>
          </div>
        ) : (
          <div className="collection-grid">
            {products.map((p) => (
              <ProductCard key={p.sku} product={p} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}