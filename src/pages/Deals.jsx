import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronRight, Flame, Home as HomeIcon, SlidersHorizontal, Tag, X,
} from "lucide-react";
import { getDeals } from "../data/products.js";
import { naira, discountPct } from "../utils/format.js";
import { SITE } from "../config/site.js";
import ProductCard from "../components/product/ProductCard.jsx";
import FilterSidebar from "../components/category/FilterSidebar.jsx";
import CountdownTimer from "../components/home/CountdownTimer.jsx";

const SORTS = [
  { id: "discount", label: "Biggest Discount First" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "rating", label: "Customer Rating" },
];

const PAGE_SIZE = 12;
const FILTER_CONFIG = ["brand", "price", "availability"];

export default function Deals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = `Deals of the Day \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  const all = useMemo(() => getDeals(), []);
  const filters = useMemo(() => readFiltersFromUrl(searchParams), [searchParams]);
  const sort = searchParams.get("sort") || "discount";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const filtered = applyFilters(all, filters);
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
    if (value === "discount") sp.delete("sort"); else sp.set("sort", value);
    sp.delete("page");
    setSearchParams(sp);
  }
  function setPage(n) {
    const sp = new URLSearchParams(searchParams);
    if (n <= 1) sp.delete("page"); else sp.set("page", String(n));
    setSearchParams(sp);
    window.scrollTo({ top: 220, behavior: "smooth" });
  }
  function clearFilters() { setSearchParams({}); }

  const activeChips = buildActiveChips(filters);
  const biggestDiscount = all.reduce((max, p) => Math.max(max, discountPct(p.price, p.was)), 0);

  return (
    <main className="wrap">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Deals of the Day</span>
      </nav>

      <section className="lhero lhero--deals">
        <div className="lhero__copy">
          <span className="lhero__pill">
            <Flame size={13} /> LIMITED TIME
          </span>
          <h1>Deals of the Day</h1>
          <p>
            Up to {biggestDiscount}% off original electronics \u2014 every deal verified, every product authentic.
          </p>
          <div className="lhero__cdown">
            <span>Offers refresh in:</span>
            <CountdownTimer />
          </div>
        </div>
        <img className="lhero__img" src="/banners/hero-deals.png" alt="" />
      </section>

      <button className="cmob-trigger" onClick={() => setDrawerOpen(true)}>
        <SlidersHorizontal size={15} />
        Filters
        {activeChips.length > 0 && <em>{activeChips.length}</em>}
      </button>

      <div className="cbody">
        <div className={"cfilter__shell" + (drawerOpen ? " cfilter__shell--open" : "")}>
          <FilterSidebar
            category={{ filterConfig: FILTER_CONFIG }}
            products={all}
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
              <b>{sorted.length}</b> deal{sorted.length === 1 ? "" : "s"}
              {sorted.length !== all.length && (
                <span className="ctoolbar__total"> of {all.length}</span>
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
              <h3>No deals match these filters</h3>
              <p>Try removing a filter to see more offers.</p>
              <button className="btn-shop" onClick={clearFilters}>Clear filters</button>
            </div>
          )}

          {totalPages > 1 && (
            <nav className="cpager" aria-label="Pagination">
              <button onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={n === currentPage ? "cpager__on" : ""}
                  aria-current={n === currentPage ? "page" : undefined}
                >{n}</button>
              ))}
              <button onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}>Next</button>
            </nav>
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------- URL <-> filters (same shape as Category/Search/Brand) ---------- */
function readFiltersFromUrl(sp) {
  const list = (k) => (sp.get(k) ? sp.get(k).split(",") : []);
  const num = (k) => (sp.get(k) ? Number(sp.get(k)) : "");
  return {
    brand: list("brand"),
    hp: list("hp"), inverter: list("inverter"),
    litres: list("litres"), doors: list("doors").map(Number),
    availability: list("availability"),
    priceMin: num("priceMin"), priceMax: num("priceMax"),
  };
}
function writeFiltersToUrl(sp, f) {
  const setList = (k, arr) => { if (arr && arr.length) sp.set(k, arr.join(",")); else sp.delete(k); };
  setList("brand", f.brand);
  setList("availability", f.availability);
  if (f.priceMin) sp.set("priceMin", String(f.priceMin)); else sp.delete("priceMin");
  if (f.priceMax) sp.set("priceMax", String(f.priceMax)); else sp.delete("priceMax");
}
function applyFilters(products, f) {
  return products.filter((p) => {
    if (f.brand.length && !f.brand.includes(p.brand)) return false;
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
    default:
      // discount: deepest discount first
      arr.sort((a, b) => discountPct(b.price, b.was) - discountPct(a.price, a.was));
  }
  return arr;
}
function buildActiveChips(f) {
  const chips = [];
  for (const v of f.brand) chips.push({ key: `brand:${v}`, type: "brand", value: v, label: v });
  for (const v of f.availability) chips.push({ key: `availability:${v}`, type: "availability", value: v, label: v });
  if (f.priceMin !== "" || f.priceMax !== "") {
    const a = f.priceMin !== "" ? naira(f.priceMin) : "Any";
    const b = f.priceMax !== "" ? naira(f.priceMax) : "Any";
    chips.push({ key: "price", type: "price", value: null, label: `Price: ${a} \u2013 ${b}` });
  }
  return chips;
}
function clearOne(searchParams, setSearchParams, chip) {
  const sp = new URLSearchParams(searchParams);
  if (chip.type === "price") {
    sp.delete("priceMin"); sp.delete("priceMax");
  } else {
    const list = (sp.get(chip.type) || "").split(",").filter(Boolean);
    const remaining = list.filter((v) => v !== String(chip.value));
    if (remaining.length) sp.set(chip.type, remaining.join(","));
    else sp.delete(chip.type);
  }
  sp.delete("page");
  setSearchParams(sp);
}