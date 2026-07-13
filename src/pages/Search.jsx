import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronRight, Home as HomeIcon, Search as SearchIcon, SlidersHorizontal, X,
} from "lucide-react";
import { PRODUCTS, CATEGORIES, BRANDS } from "../data/products.js";
import { search } from "../utils/searchEngine.js";
import { addRecentSearch } from "../utils/recentSearches.js";
import { SITE } from "../config/site.js";
import ProductCard from "../components/product/ProductCard.jsx";
import FilterSidebar from "../components/category/FilterSidebar.jsx";

const SORTS = [
  { id: "relevance", label: "Best Match" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "rating", label: "Customer Rating" },
];
const PAGE_SIZE = 12;

/**
 * Synthetic category passed to FilterSidebar — its filterConfig
 * decides which filter groups render. Search results show generic
 * filters by default; when scoped to a category, those filters
 * appear instead.
 */
const SEARCH_FILTER_CONFIG_GENERIC = ["brand", "price", "availability"];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const scope = searchParams.get("category") || null;
  const sort = searchParams.get("sort") || "relevance";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ---- record the search the first time we land on this page ----
  useEffect(() => {
    if (q) addRecentSearch(q);
    const prev = document.title;
    document.title = q ? `"${q}" — ${SITE.name}` : `Search — ${SITE.name}`;
    return () => { document.title = prev; };
  }, [q]);

  // ---- find the full set of matching products (search engine handles scoring) ----
  const allMatchedProducts = useMemo(() => {
    if (!q) return [];
    const r = search(q, { categoryScope: scope, maxProducts: 999 });
    return r.products;
  }, [q, scope]);

  // ---- build a synthetic "category" object so FilterSidebar can render ----
  const scopedCategory = scope ? CATEGORIES.find((c) => c.id === scope) : null;
  const filterCategory = useMemo(() => {
    if (scopedCategory) return scopedCategory;
    return { filterConfig: SEARCH_FILTER_CONFIG_GENERIC };
  }, [scopedCategory]);

  // ---- read filter state from URL (same shape as Category page) ----
  const filters = useMemo(() => readFiltersFromUrl(searchParams), [searchParams]);
  const filtered = applyFilters(allMatchedProducts, filters);
  const sorted = applySort(filtered, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function setFilters(updater) {
    const next = typeof updater === "function" ? updater(filters) : updater;
    const sp = new URLSearchParams(searchParams);
    writeFiltersToUrl(sp, next);
    sp.delete("page");
    setSearchParams(sp);
  }

  function setSort(value) {
    const sp = new URLSearchParams(searchParams);
    if (value === "relevance") sp.delete("sort"); else sp.set("sort", value);
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
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (scope) sp.set("category", scope);
    setSearchParams(sp);
  }

  function clearScope() {
    const sp = new URLSearchParams(searchParams);
    sp.delete("category");
    setSearchParams(sp);
  }

  // ---- empty query: prompt the user ----
  if (!q) return <EmptyQuery />;

  // ---- main render ----
  return (
    <main className="wrap">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Search results</span>
      </nav>

      <header className="chead">
        <div>
          <h1>
            <SearchIcon size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Results for "{q}"
          </h1>
          <p>
            {allMatchedProducts.length === 0
              ? "No products matched your search."
              : <>Showing {sorted.length} of {allMatchedProducts.length} matching product{allMatchedProducts.length === 1 ? "" : "s"}</>
            }
            {scopedCategory && (
              <span className="search-scope">
                in <b>{scopedCategory.label}</b>
                <button onClick={clearScope} aria-label="Remove category filter">
                  <X size={12} />
                </button>
              </span>
            )}
          </p>
        </div>
      </header>

      {/* mobile filter trigger */}
      {allMatchedProducts.length > 0 && (
        <button className="cmob-trigger" onClick={() => setDrawerOpen(true)}>
          <SlidersHorizontal size={15} />
          Filters
        </button>
      )}

      {allMatchedProducts.length === 0 ? (
        <NoResults query={q} />
      ) : (
        <div className="cbody">
          <div className={"cfilter__shell" + (drawerOpen ? " cfilter__shell--open" : "")}>
            <FilterSidebar
              category={filterCategory}
              products={allMatchedProducts}
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
                <b>{sorted.length}</b> result{sorted.length === 1 ? "" : "s"}
              </p>
              <label className="ctoolbar__sort">
                <span>Sort by:</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
            </div>

            {pageItems.length > 0 ? (
              <div className="pgrid pgrid--listing">
                {pageItems.map((p) => <ProductCard key={p.sku} product={p} />)}
              </div>
            ) : (
              <div className="cempty">
                <h3>No products match these filters</h3>
                <p>Try removing a filter or browse all results.</p>
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

/* ---------------- URL helpers (same shape as Category) ---------------- */
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
    if (f.brand.length && !f.brand.includes(p.brand)) return false;
    if (f.hp.length && (p.hp == null || !f.hp.includes(String(p.hp)))) return false;
    if (f.inverter.length) {
      if (p.inverter == null) return false;
      const flag = p.inverter ? "Inverter" : "Non-Inverter";
      if (!f.inverter.includes(flag)) return false;
    }
    if (f.litres.length) {
      if (p.litres == null) return false;
      const bucket = p.litres < 250 ? "Under 250L" : p.litres < 450 ? "250 \u2013 450L" : "Over 450L";
      if (!f.litres.includes(bucket)) return false;
    }
    if (f.doors.length && (p.doors == null || !f.doors.includes(p.doors))) return false;
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
    default: break; // relevance: keep search-engine order
  }
  return arr;
}

/* ---------------- empty states ---------------- */
function EmptyQuery() {
  return (
    <main className="wrap" style={{ padding: "60px 24px", textAlign: "center" }}>
      <SearchIcon size={48} strokeWidth={1.2} style={{ color: "var(--mut)", marginBottom: 14 }} />
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>What are you looking for?</h1>
      <p style={{ color: "var(--mut)" }}>Use the search bar above to find products, brands, or categories.</p>
    </main>
  );
}

function NoResults({ query }) {
  return (
    <section className="cempty" style={{ marginTop: 18 }}>
      <h3>No results for "{query}"</h3>
      <p>Try a different keyword, check your spelling, or browse popular categories below.</p>
      <div className="search-noresults__brands">
        {BRANDS.slice(0, 6).map((b) => (
          <Link key={b.id} to={`/search?q=${encodeURIComponent(b.name)}`} className="brand-tile">
            <img src={b.logo} alt={b.name} />
          </Link>
        ))}
      </div>
      <div className="section-head" style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 17 }}>You might like</h2>
      </div>
      <div className="pgrid" style={{ textAlign: "left" }}>
        {PRODUCTS.slice(0, 5).map((p) => <ProductCard key={p.sku} product={p} />)}
      </div>
    </section>
  );
}