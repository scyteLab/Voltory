import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, ChevronRight, Home as HomeIcon,
  Package, ShieldCheck, Truck, Wrench,
} from "lucide-react";
import { useCatalog } from "../context/CatalogContext.jsx";
import { SITE } from "../config/site.js";
import BrandLogo from "../components/brand/BrandLogo.jsx";
import SEOHead from "../components/seo/SEOHead.jsx";

/**
 * Brands directory  —  /brands
 *
 * Investor-first "Our Brand Partners" page. Amazon-clean: white,
 * generous whitespace, typography-driven hierarchy, no decorative
 * color bars. Numbers earn their place; empty prose does not.
 *
 * Three sections, top to bottom:
 *   1. Hero        — title + one sentence + ambient stats
 *   2. Grid        — every brand as a clean tile, sorted by
 *                    product count desc so strongest partners lead
 *   3. Trust       — three quiet columns + soft CTA to Contact
 *
 * Discovery of "shop LG air conditioners" happens on category pages
 * via the "Shop by Brand" filter row — not here. This page is
 * about who Voltory partners with, not what's on sale.
 */
export default function Brands() {

  const { products, brands, categories } = useCatalog();

  /* ---- Derive per-brand stats from the catalog ---- */

  const brandStats = useMemo(() => {
    // For each brand: how many products and which categories.
    const byBrandName = new Map();
    for (const p of products) {
      if (!p.brand) continue;
      let s = byBrandName.get(p.brand);
      if (!s) {
        s = { productCount: 0, categoryIds: new Set() };
        byBrandName.set(p.brand, s);
      }
      s.productCount++;
      if (p.category) s.categoryIds.add(p.category);
    }

    return brands
      .map((b) => {
        const s = byBrandName.get(b.name) || { productCount: 0, categoryIds: new Set() };
        return {
          ...b,
          productCount: s.productCount,
          categoryIds:  Array.from(s.categoryIds),
        };
      })
      .filter((b) => b.productCount > 0); // only brands with actual products
  }, [brands, products]);

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
      <SEOHead
        title="Our Brand Partners"
        description="The brands we stock at NAVEN — Scanfrost, Midea, Samsung, Sony, Panasonic, Kenwood and more. Shop premium Nigerian appliances."
      />
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
          2. COMPLETE GRID
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
          3. TRUST FOOTER
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

