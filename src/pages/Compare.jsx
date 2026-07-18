import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight, Home as HomeIcon, Plus, Repeat, ShoppingCart, Trash2, X,
} from "lucide-react";
import { useStore } from "../context/StoreContext.jsx";
import { bySku } from "../data/products.js";
import { naira, stockState } from "../utils/format.js";
import { MAX_COMPARE } from "../utils/comparison.js";
import { SITE } from "../config/site.js";
import RatingStars from "../components/product/RatingStars.jsx";

/**
 * Compare page \u2014 up to 4 products side-by-side.
 * Empty columns prompt the user to add more from the browsing.
 * Smart rows: spec rows only render if at least one product has
 * that attribute, so a comparison of TVs doesn't show empty
 * "HP" rows from the AC spec template.
 */
const ATTRIBUTE_ROWS = [
  { key: "price",     label: "Price",          format: (v) => v != null ? naira(v) : "\u2014" },
  { key: "brand",     label: "Brand" },
  { key: "category",  label: "Category",       format: (v) => categoryLabel(v) },
  { key: "rating",    label: "Rating",         render: (p) => <RatingStars rating={p.rating} reviews={p.reviews} size={12} /> },
  { key: "stock",     label: "Availability",   render: (p) => <StockBadge product={p} /> },
  { key: "hp",        label: "HP",             format: (v) => v != null ? `${v} HP` : "\u2014" },
  { key: "inverter",  label: "Inverter",       format: (v) => v === true ? "Yes" : v === false ? "No" : "\u2014" },
  { key: "litres",    label: "Capacity",       format: (v) => v != null ? `${v} L` : "\u2014" },
  { key: "doors",     label: "Doors",          format: (v) => v != null ? `${v} door${v === 1 ? "" : "s"}` : "\u2014" },
  { key: "model",     label: "Model",          format: (v) => v || "\u2014" },
];

export default function Compare() {
  const { compare, removeFromComparison, clearComparison, addToCart } = useStore();
  const items = compare.map((sku) => bySku(sku)).filter(Boolean);
  const slots = Array.from({ length: MAX_COMPARE }, (_, i) => items[i] || null);

  useEffect(() => {
    const prev = document.title;
    document.title = `Compare Products \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  // Decide which attribute rows to show: only rows where at least
  // one product has the value, OR rows that are "always shown" (price,
  // brand, category, rating, stock, model).
  const ALWAYS_SHOW = new Set(["price", "brand", "category", "rating", "stock", "model"]);
  const rows = ATTRIBUTE_ROWS.filter((r) =>
    ALWAYS_SHOW.has(r.key) || items.some((p) => p && p[r.key] != null)
  );

  // Find the row with all distinct values \u2014 the things that
  // actually distinguish these products. We'll highlight those.
  const distinctRows = new Set();
  for (const r of rows) {
    if (!r.key || r.render) continue;
    const values = items.map((p) => p?.[r.key]).filter((v) => v != null);
    if (values.length >= 2 && new Set(values.map(String)).size > 1) {
      distinctRows.add(r.key);
    }
  }

  return (
    <main className="wrap cmp-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Compare Products</span>
      </nav>

      <header className="cmp-head">
        <div>
          <h1>Compare Products</h1>
          <p>
            {items.length === 0
              ? "Add up to 4 products from anywhere on the site to see them side-by-side."
              : `Comparing ${items.length} product${items.length === 1 ? "" : "s"}. Differences highlighted in blue.`}
          </p>
        </div>
        {items.length > 0 && (
          <button className="cmp-head__clear" onClick={clearComparison}>
            <Trash2 size={14} /> Clear All
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="cmp-tablewrap">
          <table className="cmp-table">
            <thead>
              <tr>
                <th scope="col" className="cmp-table__rowhead-cell" />
                {slots.map((p, i) => (
                  <th scope="col" key={i} className="cmp-table__col">
                    {p ? <ProductHead product={p} onRemove={() => removeFromComparison(p.sku)} /> : <EmptySlot />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className={distinctRows.has(r.key) ? "cmp-row--distinct" : ""}>
                  <th scope="row" className="cmp-table__rowhead">{r.label}</th>
                  {slots.map((p, i) => (
                    <td key={i}>
                      {!p ? (
                        <span className="cmp-cell--empty">—</span>
                      ) : r.render ? (
                        r.render(p)
                      ) : r.format ? (
                        r.format(p[r.key])
                      ) : (
                        p[r.key] || "\u2014"
                      )}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Highlights row \u2014 long-form list per product */}
              {items.some((p) => p?.highlights?.length) && (
                <tr>
                  <th scope="row" className="cmp-table__rowhead">Highlights</th>
                  {slots.map((p, i) => (
                    <td key={i}>
                      {!p ? (
                        <span className="cmp-cell--empty">—</span>
                      ) : p.highlights?.length ? (
                        <ul className="cmp-highlights">
                          {p.highlights.map((h) => <li key={h}>{h}</li>)}
                        </ul>
                      ) : (
                        <span className="cmp-cell--empty">No highlights listed</span>
                      )}
                    </td>
                  ))}
                </tr>
              )}
              {/* Final row: Add to Cart per column */}
              <tr className="cmp-row--actions">
                <th scope="row" className="cmp-table__rowhead">Action</th>
                {slots.map((p, i) => (
                  <td key={i}>
                    {!p ? (
                      <Link to="/" className="cmp-add-empty">
                        <Plus size={14} /> Add product
                      </Link>
                    ) : (
                      <button
                        className="cmp-add"
                        onClick={() => addToCart(p.sku)}
                        disabled={stockState(p.stock) === "out"}
                      >
                        <ShoppingCart size={13} />
                        {stockState(p.stock) === "out" ? "Out of Stock" : "Add to Cart"}
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && items.length < MAX_COMPARE && (
        <p className="cmp-hint">
          You can add up to {MAX_COMPARE - items.length} more product{MAX_COMPARE - items.length === 1 ? "" : "s"} to this comparison.
          {" "}<Link to="/">Browse the catalogue</Link>.
        </p>
      )}
    </main>
  );
}

function ProductHead({ product, onRemove }) {
  return (
    <div className="cmp-prodhead">
      <button
        className="cmp-prodhead__remove"
        onClick={onRemove}
        aria-label={`Remove ${product.name} from comparison`}
        title="Remove"
      >
        <X size={14} />
      </button>
      <Link to={`/product/${product.slug}`} className="cmp-prodhead__img">
        {product.image && <img src={product.image} alt={product.name} />}
      </Link>
      <span className="cmp-prodhead__brand">{product.brand}</span>
      <Link to={`/product/${product.slug}`} className="cmp-prodhead__name">
        {product.name}
      </Link>
    </div>
  );
}

function EmptySlot() {
  return (
    <Link to="/" className="cmp-slot-empty">
      <span className="cmp-slot-empty__plus"><Plus size={20} /></span>
      <span>Add a product</span>
      <small>Click the <Repeat size={11} style={{ verticalAlign: "middle" }} /> on any product card</small>
    </Link>
  );
}

function StockBadge({ product }) {
  const st = stockState(product.stock);
  return (
    <span className={`pcard__stock pcard__stock--${st}`}>
      {st === "ok" ? "In Stock" : st === "low" ? `Only ${product.stock} left` : "Out of Stock"}
    </span>
  );
}

function EmptyState() {
  return (
    <section className="cmp-empty">
      <span className="cmp-empty__icon"><Repeat size={48} strokeWidth={1.2} /></span>
      <h2>Nothing to compare yet</h2>
      <p>
        Add up to <b>{MAX_COMPARE} products</b> to see them side-by-side.
        Look for the <Repeat size={13} style={{ verticalAlign: "middle" }} /> button on any product card or product page.
      </p>
      <div className="cmp-empty__actions">
        <Link to="/" className="btn-shop">Browse All Products</Link>
        <Link to="/deals" className="cmp-empty__alt">See today’s deals <ChevronRight size={14} /></Link>
      </div>
    </section>
  );
}

function categoryLabel(id) {
  const map = {
    "refrigerators-freezers": "Refrigerators & Freezers",
    "air-conditioners": "Air Conditioners",
    "washing-machines": "Washing Machines",
    "televisions-audio": "Televisions & Audio",
    "kitchen-appliances": "Kitchen Appliances",
    "small-appliances": "Small Appliances",
    "power-solutions": "Power Solutions",
    "home-comfort": "Home Comfort",
    "accessories": "Accessories",
  };
  return map[id] || id;
}