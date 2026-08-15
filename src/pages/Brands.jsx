import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, ChevronRight, Home as HomeIcon,
  Package, ShieldCheck, Truck, Wrench,
} from "lucide-react";
import { useCatalog } from "../context/CatalogContext.jsx";
import { BRAND_PAGES } from "../config/brandPages.js";
import { SITE } from "../config/site.js";
import BrandLogo from "../components/brand/BrandLogo.jsx";

/**
 * Brands directory  —  /brands
 *
 * Investor-first "Our Brand Partners" page. Amazon-clean: white,
 * generous whitespace, typography-driven hierarchy, no decorative
 * color bars. Numbers earn their place; empty prose does not.
 *
 * Four sections, top to bottom:
 *   1. Hero        — title + one sentence + two ambient stats
 *   2. Principals  — grayscale logo strip of official partners
 *   3. Spotlight   — featured brand block with real data
 *   4. Grid        — every brand as a clean tile, sorted by
 *                    product count desc so strongest partners lead
 *   5. Trust       — three quiet columns + soft CTA to Contact
 *
 * Discovery of "shop LG air conditioners" happens on category pages
 * via the "Shop by Brand" filter row — not here. This page is
 * about who Voltory partners with, not what's on sale.
 */
export default function Brands() {
  useEffect(() => {
    const prev = document.title;
    document.title = `Our Brand Partners — ${SITE.name || "NAVEN"}`;
    return () => { document.title = prev; };
  }, []);

  const { products, brands, categories } = useCatalog();

  /* ---- Derive per-brand stats from the catalog ---- */

  const brandStats = useMemo(() => {
    // For each brand: how many products, how many categories, what
    // price range. Then attach BRAND_PAGES config (tier, tagline).
    const byBrandName = new Map();
    for (const p of products) {
      if (!p.brand) continue;
      let s = byBrandName.get(p.brand);
      if (!s) {
        s = { productCount: 0, categoryIds: new Set(), minPrice: Infinity, maxPrice: 0 };
        byBrandName.set(p.brand, s);
      }
      s.productCount++;
      if (p.category) s.categoryIds.add(p.category);
      if (p.price && p.price < s.minPrice) s.minPrice = p.price;
      if (p.price && p.price > s.maxPrice) s.maxPrice = p.price;
    }

    return brands
      .map((b) => {
        const s = byBrandName.get(b.name) || { productCount: 0, categoryIds: new Set(), minPrice: 0, maxPrice: 0 };
        const config = BRAND_PAGES[b.id] || {};
        return {
          ...b,
          productCount:  s.productCount,
          categoryCount: s.categoryIds.size,
          categoryIds:   Array.from(s.categoryIds),
          minPrice:      s.minPrice === Infinity ? 0 : s.minPrice,
          maxPrice:      s.maxPrice,
          tier:          config.tier || "standard",
          tagline:       config.tagline || null,
          description:   config.description || null,
        };
      })
      .filter((b) => b.productCount > 0); // only brands with actual products
  }, [brands, products]);

  /* ---- Principals: official + featured tier brands ---- */

  const principals = useMemo(
    () => brandStats.filter((b) => b.tier === "official" || b.tier === "featured"),
    [brandStats]
  );

  /* ---- Featured spotlight: the brand with the most products
     that also has BRAND_PAGES config (so we have real prose) ---- */

  const featured = useMemo(() => {
    const withConfig = brandStats.filter((b) => b.description);
    if (withConfig.length === 0) return null;
    return withConfig.slice().sort((a, b) => b.productCount - a.productCount)[0];
  }, [brandStats]);

  /* ---- Grid: everyone, by product count desc ---- */

  const gridBrands = useMemo(
    () => brandStats.slice().sort((a, b) => b.productCount - a.productCount),
    [brandStats]
  );

  /* ---- Totals for the hero ---- */

  const totalBrands  = brandStats.length;
  const totalCategories = new Set(brandStats.flatMap((b) => b.categoryIds)).size;

  return (
    <main className="wrap bd-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Our Brand Partners</span>
      </nav>

      {/* ================================================
          1. HERO
          ================================================ */}
      <section className="bd-hero">
        <span className="bd-hero__kicker">Authorized Distributor Partnerships</span>
        <h1 className="bd-hero__title">Our Brand Partners</h1>
        <p className="bd-hero__lede">
          NAVEN is an authorized distributor and stockist for the world's
          leading appliance manufacturers. Every product ships with
          manufacturer warranty and Nigeria-wide after-sales support.
        </p>
        <div className="bd-hero__stats">
          <div>
            <b>{totalBrands}</b>
            <span>Authorized brands</span>
          </div>
          <div>
            <b>{totalCategories}</b>
            <span>Product categories</span>
          </div>
          <div>
            <b>100%</b>
            <span>Manufacturer warranty</span>
          </div>
        </div>
      </section>

      {/* ================================================
          2. PRINCIPALS STRIP
          ================================================ */}
      {principals.length > 0 && (
        <section className="bd-principals" aria-labelledby="principals-heading">
          <div className="bd-section-head">
            <span className="bd-eyebrow">Our Principals</span>
            <h2 id="principals-heading">Direct partnerships with global manufacturers</h2>
          </div>
          <div className="bd-principals__strip">
            {principals.map((b) => (
              <Link key={b.id} to={`/brand/${b.id}`} className="bd-principals__cell" title={b.name}>
                <BrandLogo brand={b} size="lg" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ================================================
          3. FEATURED SPOTLIGHT
          ================================================ */}
      {featured && (
        <section className="bd-spotlight" aria-labelledby="spotlight-heading">
          <div className="bd-spotlight__grid">
            <div className="bd-spotlight__logo">
              <BrandLogo brand={featured} size="xl" />
              {featured.tier === "official" && (
                <span className="bd-tier bd-tier--official">
                  <BadgeCheck size={12} /> Official Distributor
                </span>
              )}
            </div>
            <div className="bd-spotlight__body">
              <span className="bd-eyebrow">Featured Partner</span>
              <h2 id="spotlight-heading">{featured.name}</h2>
              {featured.tagline && (
                <p className="bd-spotlight__tagline">{featured.tagline}</p>
              )}
              <p className="bd-spotlight__desc">{featured.description}</p>
              <div className="bd-spotlight__stats">
                <div>
                  <b>{featured.productCount}</b>
                  <span>{featured.productCount === 1 ? "product" : "products"}</span>
                </div>
                <div>
                  <b>{featured.categoryCount}</b>
                  <span>{featured.categoryCount === 1 ? "category" : "categories"}</span>
                </div>
                {featured.minPrice > 0 && (
                  <div>
                    <b>from ₦{formatShortPrice(featured.minPrice)}</b>
                    <span>entry price</span>
                  </div>
                )}
              </div>
              <Link to={`/brand/${featured.id}`} className="bd-btn bd-btn--primary">
                Shop {featured.name} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ================================================
          4. COMPLETE GRID
          ================================================ */}
      <section className="bd-grid-section" aria-labelledby="grid-heading">
        <div className="bd-section-head">
          <span className="bd-eyebrow">Complete Directory</span>
          <h2 id="grid-heading">Every brand we carry</h2>
          <p>Ordered by depth of catalog. Click any brand for their full range.</p>
        </div>

        {gridBrands.length === 0 ? (
          <div className="bd-empty">
            <p>Brand catalog is being set up. Check back shortly.</p>
          </div>
        ) : (
          <div className="bd-grid">
            {gridBrands.map((b) => {
              const catLabels = b.categoryIds
                .map((id) => categories.find((c) => c.id === id)?.label)
                .filter(Boolean);
              return (
                <Link key={b.id} to={`/brand/${b.id}`} className="bd-tile">
                  <div className="bd-tile__logo-wrap">
                    <BrandLogo brand={b} size="md" />
                  </div>
                  <div className="bd-tile__body">
                    <b className="bd-tile__name">{b.name}</b>
                    <span className="bd-tile__count">
                      {b.productCount} {b.productCount === 1 ? "product" : "products"}
                    </span>
                    {catLabels.length > 0 && (
                      <span className="bd-tile__cats">
                        {catLabels.slice(0, 2).join(" · ")}
                        {catLabels.length > 2 && ` · +${catLabels.length - 2}`}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ================================================
          5. TRUST FOOTER
          ================================================ */}
      <section className="bd-trust" aria-labelledby="trust-heading">
        <div className="bd-section-head bd-section-head--center">
          <span className="bd-eyebrow">Why NAVEN</span>
          <h2 id="trust-heading">What partnership means for our customers</h2>
        </div>
        <div className="bd-trust__grid">
          <div className="bd-trust__cell">
            <BadgeCheck size={28} strokeWidth={1.4} />
            <b>Authorized distributor</b>
            <p>Direct relationships with manufacturers. No grey-market imports, no counterfeit risk.</p>
          </div>
          <div className="bd-trust__cell">
            <ShieldCheck size={28} strokeWidth={1.4} />
            <b>Full manufacturer warranty</b>
            <p>Every product covered by the original warranty from the brand — honored through our service network.</p>
          </div>
          <div className="bd-trust__cell">
            <Wrench size={28} strokeWidth={1.4} />
            <b>Nigeria-wide service</b>
            <p>Installation, repair, and parts support in Lagos, Abuja, Port Harcourt, and major cities.</p>
          </div>
        </div>

        <div className="bd-trust__cta">
          <p>Have a brand you'd like us to stock, or a partnership to discuss?</p>
          <Link to="/contact" className="bd-btn bd-btn--ghost">
            Talk to our team <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}

/* Short-form price for the spotlight stat pill:
   285000 → 285k, 1200000 → 1.2m */
function formatShortPrice(n) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return String(n);
}