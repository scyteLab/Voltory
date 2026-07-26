import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  BadgeCheck, ChevronRight, Home as HomeIcon, MessageCircle,
  ShieldCheck, SlidersHorizontal, Store, Truck, X,
} from "lucide-react";
import { useCatalog } from "../context/CatalogContext.jsx";
import { BRAND_PAGES, TIER_META } from "../config/brandPages.js";
import { SITE } from "../config/site.js";
import ProductCard from "../components/product/ProductCard.jsx";
import FilterSidebar from "../components/category/FilterSidebar.jsx";
import BrandLogo from "../components/brand/BrandLogo.jsx";

const SORTS = [
  { id: "popular", label: "Popularity" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "newest", label: "Newest" },
  { id: "rating", label: "Customer Rating" },
];

const PAGE_SIZE = 12;

/**
 * Synthetic "category" handed to FilterSidebar so it renders the
 * right groups. Brand filter is omitted (we're scoped to one brand
 * already); everything else stays available.
 */
const BRAND_FILTER_CONFIG = ["price", "availability"];

export default function Brand() {
  const { id: brandId } = useParams();
  const { findBrand, byBrand } = useCatalog();
  const brand = findBrand(brandId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allProducts = useMemo(() => brand ? byBrand(brand.name) : [], [brand, byBrand]);
  const filters = useMemo(() => readFiltersFromUrl(searchParams), [searchParams]);

  useEffect(() => {
    if (brand) {
      const prev = document.title;
      document.title = `${brand.name} \u2014 ${SITE.name}`;
      return () => { document.title = prev; };
    }
  }, [brand]);

  if (!brand) return <BrandNotFound id={brandId} />;
  const sort = searchParams.get("sort") || "popular";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const filtered = applyFilters(allProducts, filters);
  const sorted = applySort(filtered, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const meta = BRAND_PAGES[brand.id] || {};
  const tier = TIER_META[meta.tier] || TIER_META.standard;
  const heroColor = meta.heroColor || "var(--p-dark)";

  function setFilters(updater) {
    const next = typeof updater === "function" ? updater(filters) : updater;
    const sp = new URLSearchParams(searchParams);
    writeFiltersToUrl(sp, next);
    sp.delete("page");
    setSearchParams(sp);
  }

  function setSort(value) {
    const sp = new URLSearchParams(searchParams);
    if (value === "popular") sp.delete("sort"); else sp.set("sort", value);
    sp.delete("page");
    setSearchParams(sp);
  }

  function setPage(n) {
    const sp = new URLSearchParams(searchParams);
    if (n <= 1) sp.delete("page"); else sp.set("page", String(n));
    setSearchParams(sp);
    window.scrollTo({ top: 220, behavior: "smooth" });
  }

  function clearFilters() {
    setSearchParams({});
  }

  const activeChips = buildActiveChips(filters);

  return (
    <main className="wrap">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <Link to="/brands">Brands</Link>
        <ChevronRight size={12} />
        <span>{brand.name}</span>
      </nav>

      {/* Brand hero */}
      <section
        className="bhero"
        style={{ background: `linear-gradient(135deg, ${heroColor}, color-mix(in srgb, ${heroColor} 75%, #000))` }}
      >
        <div className="bhero__main">
          <span className="bhero__logo">
            <BrandLogo brand={brand} size="lg" />
          </span>
          <div>
            <div className="bhero__top">
              <h1>{brand.name}</h1>
              {tier.label && <span className={"btier " + tier.badgeClass}>{tier.label}</span>}
            </div>
            <p className="bhero__tag">{meta.tagline || `Shop authentic products from ${brand.name}.`}</p>
            <p className="bhero__count">
              <Store size={13} /> {allProducts.length} product{allProducts.length === 1 ? "" : "s"} available
            </p>
          </div>
        </div>
        <div className="bhero__trust">
          <span><ShieldCheck size={14} /> Original Stock</span>
          <span><BadgeCheck size={14} /> Brand Warranty</span>
          <span><Truck size={14} /> Nationwide Delivery</span>
        </div>
      </section>

      {/* About strip */}
      {meta.description && (
        <section className="babout">
          <h2>About {brand.name}</h2>
          <p>{meta.description}</p>
          <a
            href={SITE.whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="babout__wa"
          >
            <MessageCircle size={14} /> Ask our experts about {brand.name} products
          </a>
        </section>
      )}

      {/* Mobile filter trigger */}
      <button className="cmob-trigger" onClick={() => setDrawerOpen(true)}>
        <SlidersHorizontal size={15} />
        Filters
        {activeChips.length > 0 && <em>{activeChips.length}</em>}
      </button>

      {allProducts.length === 0 ? (
        <div className="cempty" style={{ marginTop: 18 }}>
          <h3>No {brand.name} products yet</h3>
          <p>Check back soon — we're constantly expanding our catalogue.</p>
          <Link to="/brands" className="btn-shop">Browse All Brands</Link>
        </div>
      ) : (
        <div className="cbody">
          <div className={"cfilter__shell" + (drawerOpen ? " cfilter__shell--open" : "")}>
            <FilterSidebar
              category={{ filterConfig: BRAND_FILTER_CONFIG }}
              products={allProducts}
              filters={filters}
              setFilters={setFilters}
              onClear={clearFilters}
              onClose={drawerOpen ? () => setDrawerOpen(false) : null}
            />
          </div>
          {drawerOpen && <div className="cfilter__backdrop" onClick={() => setDrawerOpen(false)} />}

          <section className="cmain">
            <div className="ctoolbar">
              <p className="ctoolbar__count">
                <b>{sorted.length}</b> product{sorted.length === 1 ? "" : "s"}
                {sorted.length !== allProducts.length && (
                  <span className="ctoolbar__total"> of {allProducts.length}</span>
                )}
              </p>
              <label className="ctoolbar__sort">
                <span>Sort by:</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            </div>

            {activeChips.length > 0 && (
              <ul className="cchips">
                {activeChips.map((c) => (
                  <li key={c.key}>
                    <button onClick={() => clearOne(searchParams, setSearchParams, c)}>
                      {c.label} <X size={12} />
                    </button>
                  </li>
                ))}
                <li>
                  <button className="cchips__clear" onClick={clearFilters}>Clear all</button>
                </li>
              </ul>
            )}

            {pageItems.length > 0 ? (
              <div className="pgrid pgrid--listing">
                {pageItems.map((p) => <ProductCard key={p.sku} product={p} />)}
              </div>
            ) : (
              <div className="cempty">
                <h3>No products match these filters</h3>
                <p>Try removing a filter, or browse all {brand.name} products.</p>
                <button className="btn-shop" onClick={clearFilters}>Clear filters</button>
              </div>
            )}

            {totalPages > 1 && (
              <nav className="cpager" aria-label="Pagination">
                <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={n === currentPage ? "cpager__on" : ""}
                    aria-current={n === currentPage ? "page" : undefined}
                  >
                    {n}
                  </button>
                ))}
                <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>
                  Next
                </button>
              </nav>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

/* ---------- URL <-> filters (same shape as Category) ---------- */
function readFiltersFromUrl(sp) {
  const list = (k) => (sp.get(k) ? sp.get(k).split(",") : []);
  const num = (k) => (sp.get(k) ? Number(sp.get(k)) : "");
  return {
    brand: list("brand"),
    hp: list("hp"),
    inverter: list("inverter"),
    litres: list("litres"),
    doors: list("doors").map((d) => Number(d)),
    availability: list("availability"),
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
  };
}

function writeFiltersToUrl(sp, f) {
  const setList = (k, arr) => {
    if (arr && arr.length) sp.set(k, arr.join(","));
    else sp.delete(k);
  };
  setList("brand", f.brand);
  setList("hp", f.hp);
  setList("inverter", f.inverter);
  setList("litres", f.litres);
  setList("doors", f.doors);
  setList("availability", f.availability);
  if (f.priceMin) sp.set("priceMin", String(f.priceMin)); else sp.delete("priceMin");
  if (f.priceMax) sp.set("priceMax", String(f.priceMax)); else sp.delete("priceMax");
}

function applyFilters(products, f) {
  return products.filter((p) => {
    if (f.availability.length) {
      const flag = p.stock > 0 ? "In Stock" : "Out of Stock";
      if (!f.availability.includes(flag)) return false;
    }
    if (f.priceMin !== "" && p.price < f.priceMin) return false;
    if (f.priceMax !== "" && p.price > f.priceMax) return false;
    return true;
  });
}

function applySort(items, sort) {
  const arr = [...items];
  switch (sort) {
    case "price-asc": arr.sort((a, b) => a.price - b.price); break;
    case "price-desc": arr.sort((a, b) => b.price - a.price); break;
    case "rating": arr.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    case "newest":
      arr.sort((a, b) => (a.badge === "new" ? -1 : 1) - (b.badge === "new" ? -1 : 1));
      break;
    default:
      arr.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  }
  return arr;
}

function buildActiveChips(f) {
  const chips = [];
  for (const v of f.availability) chips.push({ key: `availability:${v}`, type: "availability", value: v, label: v });
  if (f.priceMin !== "" || f.priceMax !== "") {
    const a = f.priceMin !== "" ? `\u20A6${f.priceMin.toLocaleString()}` : "Any";
    const b = f.priceMax !== "" ? `\u20A6${f.priceMax.toLocaleString()}` : "Any";
    chips.push({ key: "price", type: "price", value: null, label: `Price: ${a} \u2013 ${b}` });
  }
  return chips;
}

function clearOne(searchParams, setSearchParams, chip) {
  const sp = new URLSearchParams(searchParams);
  if (chip.type === "price") {
    sp.delete("priceMin");
    sp.delete("priceMax");
  } else {
    const list = (sp.get(chip.type) || "").split(",").filter(Boolean);
    const remaining = list.filter((v) => v !== String(chip.value));
    if (remaining.length) sp.set(chip.type, remaining.join(","));
    else sp.delete(chip.type);
  }
  sp.delete("page");
  setSearchParams(sp);
}

function BrandNotFound({ id }) {
  return (
    <main className="wrap" style={{ padding: "60px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>Brand not found</h1>
      <p style={{ color: "var(--mut)", marginBottom: 22 }}>
        We don't stock <b>{id}</b> products yet. Try browsing all our brands.
      </p>
      <Link to="/brands" className="btn-shop" style={{ display: "inline-block", padding: "12px 24px" }}>
        Browse All Brands
      </Link>
    </main>
  );
}