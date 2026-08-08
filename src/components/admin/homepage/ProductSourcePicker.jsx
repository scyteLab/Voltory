import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useCatalog } from "../../../context/CatalogContext.jsx";

/**
 * ProductSourcePicker
 *
 * Editor for the `source` field on a ProductRowSection config.
 * Four modes:
 *   \u00B7 auto       \u2014 use the section's default (deals or featured)
 *   \u00B7 tag        \u2014 filter products by tag
 *   \u00B7 category   \u2014 all products in a category
 *   \u00B7 skus       \u2014 hand-picked SKUs, in order
 *
 * Also handles the `limit` field (max items to show).
 */

function currentMode(source) {
  if (!source || source === "auto") return "auto";
  if (typeof source !== "object") return "auto";
  if (Array.isArray(source.skus) && source.skus.length > 0) return "skus";
  if (source.tag) return "tag";
  if (source.category) return "category";
  return "auto";
}

export default function ProductSourcePicker({ config = {}, onChange }) {
  const { products, categories } = useCatalog();
  const [mode, setMode] = useState(() => currentMode(config.source));

  // Collect every distinct product tag for the tag picker
  const allTags = useMemo(() => {
    const set = new Set();
    for (const p of products) {
      if (Array.isArray(p.tags)) p.tags.forEach((t) => set.add(String(t)));
    }
    return Array.from(set).sort();
  }, [products]);

  const source = config.source && typeof config.source === "object" ? config.source : {};
  const limit  = config.limit || 10;

  function setMode2(newMode) {
    setMode(newMode);
    if (newMode === "auto") {
      onChange({ source: "auto" });
    } else if (newMode === "tag") {
      onChange({ source: { tag: allTags[0] || "" } });
    } else if (newMode === "category") {
      onChange({ source: { category: categories[0]?.id || "" } });
    } else if (newMode === "skus") {
      onChange({ source: { skus: [] } });
    }
  }

  return (
    <div className="hb-source">
      <div className="hb-source__row">
        <label className="hb-lbl">Product source</label>
        <div className="hb-tabs">
          {[
            ["auto",     "Automatic"],
            ["tag",      "By tag"],
            ["category", "By category"],
            ["skus",     "Hand-pick"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={"hb-tab" + (mode === k ? " hb-tab--on" : "")}
              onClick={() => setMode2(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "auto" && (
        <p className="hb-hint">
          Uses the section's default behavior. Deals rows show discounted products;
          featured rows show top products from the catalog.
        </p>
      )}

      {mode === "tag" && (
        <div className="hb-source__row">
          <label className="hb-lbl">Tag</label>
          {allTags.length === 0 ? (
            <p className="hb-hint">No products have tags yet. Add tags in Products \u2192 Edit.</p>
          ) : (
            <select
              className="hb-input"
              value={source.tag || ""}
              onChange={(e) => onChange({ source: { tag: e.target.value } })}
            >
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      )}

      {mode === "category" && (
        <div className="hb-source__row">
          <label className="hb-lbl">Category</label>
          <select
            className="hb-input"
            value={source.category || ""}
            onChange={(e) => onChange({ source: { category: e.target.value } })}
          >
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      )}

      {mode === "skus" && (
        <SkuPicker
          skus={source.skus || []}
          products={products}
          onChange={(nextSkus) => onChange({ source: { skus: nextSkus } })}
        />
      )}

      <div className="hb-source__row">
        <label className="hb-lbl">Max items</label>
        <input
          type="number"
          min={1}
          max={50}
          value={limit}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n > 0 && n <= 50) onChange({ limit: n });
          }}
          className="hb-input hb-input--sm"
        />
      </div>
    </div>
  );
}

function SkuPicker({ skus, products, onChange }) {
  const [query, setQuery] = useState("");
  const picked = skus.map((sku) => products.find((p) => p.sku === sku)).filter(Boolean);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !skus.includes(p.sku))
      .filter((p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand || "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query, products, skus]);

  function add(sku) {
    onChange([...skus, sku]);
    setQuery("");
  }
  function remove(sku) {
    onChange(skus.filter((s) => s !== sku));
  }
  function moveUp(i) {
    if (i === 0) return;
    const next = [...skus];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  }
  function moveDown(i) {
    if (i === skus.length - 1) return;
    const next = [...skus];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  }

  return (
    <div className="hb-skus">
      {picked.length > 0 && (
        <ol className="hb-skus__list">
          {picked.map((p, i) => (
            <li key={p.sku} className="hb-skus__item">
              <span className="hb-skus__num">{i + 1}</span>
              <div className="hb-skus__meta">
                <b>{p.name}</b>
                <small className="mono">{p.sku}</small>
              </div>
              <div className="hb-skus__actions">
                <button type="button" onClick={() => moveUp(i)}    disabled={i === 0} title="Move up">\u2191</button>
                <button type="button" onClick={() => moveDown(i)}  disabled={i === picked.length - 1} title="Move down">\u2193</button>
                <button type="button" onClick={() => remove(p.sku)} title="Remove"><X size={13} /></button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="hb-skus__search">
        <input
          type="text"
          placeholder="Search products by name, SKU, or brand\u2026"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="hb-input"
        />
        {results.length > 0 && (
          <ul className="hb-skus__results">
            {results.map((p) => (
              <li key={p.sku}>
                <button type="button" onClick={() => add(p.sku)}>
                  <b>{p.name}</b>
                  <small className="mono">{p.sku} \u00B7 {p.brand}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}