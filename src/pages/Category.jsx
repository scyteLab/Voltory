import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChevronRight, Home as HomeIcon, SlidersHorizontal, X } from "lucide-react";
import { useCatalog } from "../context/CatalogContext.jsx";
import { BRAND_PAGES } from "../config/brandPages.js";
import { naira, discountPct } from "../utils/format.js";
import { SITE } from "../config/site.js";
import ProductCard from "../components/product/ProductCard.jsx";
import FilterSidebar from "../components/category/FilterSidebar.jsx";
import BuyingGuide from "../components/category/BuyingGuide.jsx";
import BrandLogo from "../components/brand/BrandLogo.jsx";
import {
  fetchFilterableAttributesForCategory,
  fetchProductAttributesForCategory,
  buildProductAttributeMap,
} from "../lib/productAttributesClient.js";

const SORTS = [
  { id: "popular", label: "Popularity" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
  { id: "newest", label: "Newest" },
  { id: "rating", label: "Customer Rating" },
  { id: "discount", label: "Biggest Discount" },
];

const PAGE_SIZE = 12;

/**
 * URL prefix for attribute filters:
 *   ?attr_color=silver,black
 *   ?attr_capacity=300-500       (number range: min-max)
 *   ?attr_inverter=true          (boolean)
 *
 * Prefix keeps attribute filters cleanly separated from the
 * hardcoded ones (brand, hp, price, etc.), avoids name collisions,
 * and makes them obvious in the URL bar.
 */
const ATTR_PREFIX = "attr_";

export default function Category() {
  const { id: categoryId } = useParams();
  const { products, brands, byCategory, byId } = useCatalog();
  const category = byId(categoryId);
  const [searchParams, setSearchParams] = useSearchParams();

  /* ---- Attribute definitions + assigned values for this category ---- */
  const [attributes, setAttributes] = useState([]);      // filterable attribute defs
  const [productAttrMap, setProductAttrMap] = useState(new Map()); // sku → slug → value(s)
  const [attrLoading, setAttrLoading] = useState(false);

  useEffect(() => {
    if (!categoryId) return;
    let cancelled = false;
    setAttrLoading(true);
    (async () => {
      const [attrsRes, pavRes] = await Promise.all([
        fetchFilterableAttributesForCategory(categoryId),
        fetchProductAttributesForCategory(categoryId),
      ]);
      if (cancelled) return;
      setAttrLoading(false);
      if (attrsRes.ok) setAttributes(attrsRes.data);
      if (pavRes.ok)   setProductAttrMap(buildProductAttributeMap(pavRes.data));
    })();
    return () => { cancelled = true; };
  }, [categoryId]);

  /* ---- Filter state (hardcoded + attribute) ---- */
  const filters = useMemo(() => readFiltersFromUrl(searchParams), [searchParams]);
  const attrFilters = useMemo(() => readAttrFiltersFromUrl(searchParams, attributes), [searchParams, attributes]);

  const sort = searchParams.get("sort") || "popular";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (category) {
      const prev = document.title;
      document.title = `${category.label} — ${SITE.name}`;
      return () => { document.title = prev; };
    }
  }, [category]);

  const baseProducts = byCategory(categoryId);
  const filtered = applyAllFilters(baseProducts, filters, attrFilters, attributes, productAttrMap);
  const sorted = applySort(filtered, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /* Compute attribute filter counts based on the CURRENT filtered set
     (so counts update as user narrows). "Silver (12)" → "Silver (7)"
     after another filter is added. */
  const attributeCounts = useMemo(
    () => computeAttributeCounts(filtered, attributes, productAttrMap),
    [filtered, attributes, productAttrMap]
  );

  function setFilters(updater) {
    const next = typeof updater === "function" ? updater(filters) : updater;
    const sp = new URLSearchParams(searchParams);
    writeFiltersToUrl(sp, next);
    sp.delete("page");
    setSearchParams(sp, { replace: false });
  }

  function setAttrFilter(slug, value) {
    const sp = new URLSearchParams(searchParams);
    writeAttrFilterToUrl(sp, slug, value);
    sp.delete("page");
    setSearchParams(sp, { replace: false });
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
    window.scrollTo({ top: 500, behavior: "smooth" });
  }

  function clearFilters() { setSearchParams({}); }

  const activeChips = buildActiveChips(filters, attrFilters, attributes);

  /* Top deals — scoped to CURRENT filter state (hardcoded + attribute),
     same as before */
  const topDeals = filtered
    .filter((p) => p.was && p.was > p.price)
    .sort((a, b) => discountPct(b.price, b.was) - discountPct(a.price, a.was))
    .slice(0, 8);

  /* Brands strip — hides once brand filter is active, same as before */
  const brandFilterActive = filters.brand && filters.brand.length > 0;
  const categoryBrands = useMemo(() => {
    if (brandFilterActive) return [];
    const names = [...new Set(baseProducts.map((p) => p.brand))];
    return names.map((n) => brands.find((b) => b.name === n)).filter(Boolean);
  }, [baseProducts, brands, brandFilterActive]);

  if (!category) return <CategoryNotFound id={categoryId} />;

  const subCats = category.megamenu?.find((g) => g.heading === "By Type")?.items || [];

  return (
    <main className="wrap">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <Link to="/categories">Categories</Link>
        <ChevronRight size={12} />
        <span>{category.label}</span>
      </nav>

      <header className="chead">
        <div>
          <h1>{category.label}</h1>
          <p>{category.blurb}</p>
        </div>
        <div className="chead__pills">
          <span>✓ 100% Original</span>
          <span>✓ Fast Delivery</span>
          <span>✓ Warranty Included</span>
        </div>
      </header>

      {/* === TOP DEALS CAROUSEL === */}
      {topDeals.length > 0 && (
        <section className="cdeals">
          <div className="cdeals__header">
            <span>
              Top Deals on
              {brandFilterActive && filters.brand.length === 1 ? ` ${filters.brand[0]} ` : " "}
              {category.label}
            </span>
          </div>
          <div className="cdeals__grid">
            {topDeals.map((p) => (
              <Link to={`/product/${p.slug}`} key={p.sku} className="cdeal-card">
                <span className="cdeal-card__off">-{discountPct(p.price, p.was)}%</span>
                <span className="cdeal-card__img">
                  {p.image && <img src={p.image} alt={p.name} loading="lazy" />}
                </span>
                <span className="cdeal-card__name">{p.name}</span>
                <span className="cdeal-card__price">{naira(p.price)}</span>
                <span className="cdeal-card__was">{naira(p.was)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* === SHOP BY BRAND === */}
      {categoryBrands.length > 1 && (
        <section className="cbrands">
          <div className="cbrands__header">
            <span>Shop by Brand</span>
          </div>
          <div className="cbrands__row">
            {categoryBrands.map((b) => {
              const meta = BRAND_PAGES[b.id] || {};
              return (
                <Link
                  to={`/brand/${b.id}`}
                  key={b.id}
                  className="cbrands__tile"
                  style={b.logo ? { backgroundImage: `url(${products.find((p) => p.brand === b.name)?.image || ""})` } : undefined}
                >
                  <span className="cbrands__overlay" />
                  <span className="cbrands__logo">
                    <BrandLogo brand={b} size="md" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <BuyingGuide categoryId={categoryId} />

      {/* mobile filter trigger */}
      <button className="cmob-trigger" onClick={() => setDrawerOpen(true)}>
        <SlidersHorizontal size={15} />
        Filters
        {activeChips.length > 0 && <em>{activeChips.length}</em>}
      </button>

      <div className="cbody">
        {/* sidebar */}
        <div className={"cfilter__shell" + (drawerOpen ? " cfilter__shell--open" : "")}>
          {subCats.length > 0 && (
            <div className="csub">
              <h3>CATEGORY</h3>
              <p className="csub__parent">{category.label}</p>
              <ul className="csub__list">
                {subCats.map((s) => (
                  <li key={s}>
                    <button
                      className="csub__link"
                      onClick={() => { /* sub-cat filtering visual-only for now */ }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <FilterSidebar
            category={category}
            products={baseProducts}
            filters={filters}
            setFilters={setFilters}
            onClear={clearFilters}
            onClose={drawerOpen ? () => setDrawerOpen(false) : null}
            /* Session 3 additions */
            attributes={attributes}
            attrFilters={attrFilters}
            setAttrFilter={setAttrFilter}
            attributeCounts={attributeCounts}
          />
        </div>
        {drawerOpen && <div className="cfilter__backdrop" onClick={() => setDrawerOpen(false)} />}

        <section className="cmain">
          <div className="cmain__heading">
            <h2>{category.label} in Nigeria</h2>
            <span className="cmain__found">({baseProducts.length} products found)</span>
          </div>

          <div className="ctoolbar">
            <p className="ctoolbar__count">
              <b>{sorted.length}</b> product{sorted.length === 1 ? "" : "s"}
              {sorted.length !== baseProducts.length && (
                <span className="ctoolbar__total"> of {baseProducts.length}</span>
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
              <p>Try removing a filter, or browse the full {category.label} catalogue.</p>
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
    </main>
  );
}

/* ============================================================
   URL ↔ filter state (HARDCODED filters, unchanged from before)
   ============================================================ */
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
    rating: num("rating"),
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
  if (f.rating) sp.set("rating", String(f.rating)); else sp.delete("rating");
  if (f.priceMin) sp.set("priceMin", String(f.priceMin)); else sp.delete("priceMin");
  if (f.priceMax) sp.set("priceMax", String(f.priceMax)); else sp.delete("priceMax");
}

/* ============================================================
   URL ↔ filter state (ATTRIBUTE filters, new in Session 3)
   ============================================================ */

/**
 * Parse attribute filters out of the URL search params.
 * Shape returned depends on attribute type:
 *   select/multi_select/color → array of value strings
 *   number                    → { min, max }  (either can be null)
 *   boolean                   → true | false | null
 *
 * Requires the attribute definitions to know how to parse each
 * value — we can't tell "300-500" is a number range vs a
 * literal string without type info.
 */
function readAttrFiltersFromUrl(sp, attributes) {
  const out = {};
  for (const attr of attributes || []) {
    const raw = sp.get(ATTR_PREFIX + attr.slug);
    if (!raw) continue;

    if (attr.type === "number") {
      const [minStr, maxStr] = raw.split("-");
      const min = minStr ? Number(minStr) : null;
      const max = maxStr ? Number(maxStr) : null;
      if (Number.isFinite(min) || Number.isFinite(max)) {
        out[attr.slug] = {
          min: Number.isFinite(min) ? min : null,
          max: Number.isFinite(max) ? max : null,
        };
      }
    } else if (attr.type === "boolean") {
      if (raw === "true")  out[attr.slug] = true;
      if (raw === "false") out[attr.slug] = false;
    } else {
      /* select, multi_select, color — comma-separated values */
      out[attr.slug] = raw.split(",").filter(Boolean);
    }
  }
  return out;
}

function writeAttrFilterToUrl(sp, slug, value) {
  const key = ATTR_PREFIX + slug;

  if (value == null) {
    sp.delete(key);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) sp.delete(key);
    else sp.set(key, value.join(","));
    return;
  }
  if (typeof value === "object") {
    /* number range */
    const min = value.min ?? "";
    const max = value.max ?? "";
    if (min === "" && max === "") sp.delete(key);
    else sp.set(key, `${min}-${max}`);
    return;
  }
  if (typeof value === "boolean") {
    sp.set(key, String(value));
    return;
  }
  /* string fallback */
  sp.set(key, String(value));
}

/* ============================================================
   FILTER APPLICATION
   ============================================================ */

function applyAllFilters(products, f, attrF, attributes, productAttrMap) {
  const attrBySlug = new Map((attributes || []).map((a) => [a.slug, a]));

  return products.filter((p) => {
    /* ---- Hardcoded filters (unchanged) ---- */
    if (f.brand.length && !f.brand.includes(p.brand)) return false;
    if (f.hp.length && (p.hp == null || !f.hp.includes(String(p.hp)))) return false;
    if (f.inverter.length) {
      if (p.inverter == null) return false;
      const flag = p.inverter ? "Inverter" : "Non-Inverter";
      if (!f.inverter.includes(flag)) return false;
    }
    if (f.litres.length) {
      if (p.litres == null) return false;
      const bucket = p.litres < 250 ? "Under 250L" : p.litres < 450 ? "250 – 450L" : "Over 450L";
      if (!f.litres.includes(bucket)) return false;
    }
    if (f.doors.length && (p.doors == null || !f.doors.includes(p.doors))) return false;
    if (f.availability.length) {
      const flag = p.stock > 0 ? "In Stock" : "Out of Stock";
      if (!f.availability.includes(flag)) return false;
    }
    if (f.rating) {
      const stars = Number(p.rating) || 0;
      if (stars < f.rating) return false;
    }
    if (f.priceMin !== "" && p.price < f.priceMin) return false;
    if (f.priceMax !== "" && p.price > f.priceMax) return false;

    /* ---- Attribute filters (Session 3) ---- */
    const productAttrs = productAttrMap.get(p.sku);
    for (const [slug, filterValue] of Object.entries(attrF)) {
      const attr = attrBySlug.get(slug);
      if (!attr) continue;

      const productValue = productAttrs?.get(slug);

      /* If product has no value for this attribute, it fails any
         non-empty filter for it. */
      if (productValue == null) return false;

      switch (attr.type) {
        case "select":
        case "color": {
          /* Product has one value; filter is a list — must include */
          if (!Array.isArray(filterValue) || filterValue.length === 0) break;
          if (!filterValue.includes(productValue)) return false;
          break;
        }
        case "multi_select": {
          /* Product has an array; filter is a list — must intersect */
          if (!Array.isArray(filterValue) || filterValue.length === 0) break;
          if (!Array.isArray(productValue)) return false;
          const matches = productValue.some((v) => filterValue.includes(v));
          if (!matches) return false;
          break;
        }
        case "number": {
          const n = Number(productValue);
          if (!Number.isFinite(n)) return false;
          if (filterValue.min != null && n < filterValue.min) return false;
          if (filterValue.max != null && n > filterValue.max) return false;
          break;
        }
        case "boolean": {
          if (filterValue !== productValue) return false;
          break;
        }
        default:
          break;
      }
    }

    return true;
  });
}

function applySort(items, sort) {
  const arr = [...items];
  switch (sort) {
    case "price-asc": arr.sort((a, b) => a.price - b.price); break;
    case "price-desc": arr.sort((a, b) => b.price - a.price); break;
    case "rating": arr.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    case "discount":
      arr.sort((a, b) => discountPct(b.price, b.was) - discountPct(a.price, a.was));
      break;
    case "newest":
      arr.sort((a, b) => (a.badge === "new" ? -1 : 1) - (b.badge === "new" ? -1 : 1));
      break;
    default:
      arr.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
  }
  return arr;
}

/* ============================================================
   ATTRIBUTE COUNTS (per filter option, based on current filter set)
   ============================================================
   Returns shape:
     {
       [slug]: {
         [value]: count,          // for select/multi_select/color
         min: N, max: N,          // for number attributes
         true: N, false: N,       // for boolean attributes
       }
     }
*/
function computeAttributeCounts(filteredProducts, attributes, productAttrMap) {
  const counts = {};
  for (const attr of attributes || []) counts[attr.slug] = {};

  for (const p of filteredProducts) {
    const productAttrs = productAttrMap.get(p.sku);
    if (!productAttrs) continue;

    for (const attr of attributes) {
      const val = productAttrs.get(attr.slug);
      if (val == null) continue;
      const bucket = counts[attr.slug];

      switch (attr.type) {
        case "select":
        case "color":
          bucket[val] = (bucket[val] || 0) + 1;
          break;
        case "multi_select":
          if (Array.isArray(val)) {
            for (const v of val) bucket[v] = (bucket[v] || 0) + 1;
          }
          break;
        case "number": {
          const n = Number(val);
          if (!Number.isFinite(n)) break;
          if (bucket.min == null || n < bucket.min) bucket.min = n;
          if (bucket.max == null || n > bucket.max) bucket.max = n;
          break;
        }
        case "boolean":
          if (val === true)  bucket.true  = (bucket.true  || 0) + 1;
          if (val === false) bucket.false = (bucket.false || 0) + 1;
          break;
        default:
          break;
      }
    }
  }

  return counts;
}

/* ============================================================
   ACTIVE FILTER CHIPS
   ============================================================ */
function buildActiveChips(f, attrF, attributes) {
  const chips = [];

  /* Hardcoded chips (unchanged) */
  for (const v of f.brand) chips.push({ key: `brand:${v}`, type: "brand", value: v, label: v });
  for (const v of f.hp) chips.push({ key: `hp:${v}`, type: "hp", value: v, label: `${v} HP` });
  for (const v of f.inverter) chips.push({ key: `inverter:${v}`, type: "inverter", value: v, label: v });
  for (const v of f.litres) chips.push({ key: `litres:${v}`, type: "litres", value: v, label: v });
  for (const v of f.doors) chips.push({ key: `doors:${v}`, type: "doors", value: v, label: `${v} Door${v === 1 ? "" : "s"}` });
  for (const v of f.availability) chips.push({ key: `availability:${v}`, type: "availability", value: v, label: v });
  if (f.rating) {
    chips.push({ key: "rating", type: "rating", value: null, label: `${f.rating}★ & up` });
  }
  if (f.priceMin !== "" || f.priceMax !== "") {
    const a = f.priceMin !== "" ? `₦${f.priceMin.toLocaleString()}` : "Any";
    const b = f.priceMax !== "" ? `₦${f.priceMax.toLocaleString()}` : "Any";
    chips.push({ key: "price", type: "price", value: null, label: `Price: ${a} – ${b}` });
  }

  /* Attribute chips (Session 3) */
  const attrBySlug = new Map((attributes || []).map((a) => [a.slug, a]));
  for (const [slug, value] of Object.entries(attrF)) {
    const attr = attrBySlug.get(slug);
    if (!attr) continue;

    if (Array.isArray(value)) {
      for (const v of value) {
        const av = (attr.allowed_values || []).find((x) => x.value === v);
        chips.push({
          key: `attr:${slug}:${v}`,
          type: `attr:${slug}`,
          value: v,
          label: `${attr.name}: ${av?.label || v}`,
        });
      }
    } else if (typeof value === "object" && value != null) {
      const min = value.min != null ? value.min : "";
      const max = value.max != null ? value.max : "";
      if (min === "" && max === "") continue;
      const unit = attr.unit ? ` ${attr.unit}` : "";
      const label = `${attr.name}: ${min || "Any"}${unit} – ${max || "Any"}${unit}`;
      chips.push({ key: `attr:${slug}`, type: `attr:${slug}`, value: null, label });
    } else if (typeof value === "boolean") {
      chips.push({
        key: `attr:${slug}`,
        type: `attr:${slug}`,
        value: null,
        label: `${attr.name}: ${value ? "Yes" : "No"}`,
      });
    }
  }

  return chips;
}

function clearOne(searchParams, setSearchParams, chip) {
  const sp = new URLSearchParams(searchParams);

  /* Attribute chip — type starts with "attr:" */
  if (chip.type.startsWith("attr:")) {
    const slug = chip.type.slice(5);
    const key = ATTR_PREFIX + slug;
    if (chip.value == null) {
      /* Whole-attribute clear (number range, boolean) */
      sp.delete(key);
    } else {
      /* Single value from multi-value attribute */
      const list = (sp.get(key) || "").split(",").filter(Boolean);
      const remaining = list.filter((v) => v !== String(chip.value));
      if (remaining.length) sp.set(key, remaining.join(","));
      else sp.delete(key);
    }
    sp.delete("page");
    setSearchParams(sp);
    return;
  }

  /* Hardcoded chip clearing (unchanged) */
  if (chip.type === "price") {
    sp.delete("priceMin");
    sp.delete("priceMax");
  } else if (chip.type === "rating") {
    sp.delete("rating");
  } else {
    const list = (sp.get(chip.type) || "").split(",").filter(Boolean);
    const remaining = list.filter((v) => v !== String(chip.value));
    if (remaining.length) sp.set(chip.type, remaining.join(","));
    else sp.delete(chip.type);
  }
  sp.delete("page");
  setSearchParams(sp);
}

function CategoryNotFound({ id }) {
  return (
    <main className="wrap" style={{ padding: "60px 24px", textAlign: "center" }}>
      <h1 style={{ fontSize: 26, marginBottom: 10 }}>Category not found</h1>
      <p style={{ color: "var(--mut)", marginBottom: 22 }}>
        <b>{id}</b> isn't a category we currently stock. Try the home page or browse our categories.
      </p>
      <Link to="/" className="btn-shop" style={{ display: "inline-block", padding: "12px 24px" }}>
        Back to Home
      </Link>
    </main>
  );
}