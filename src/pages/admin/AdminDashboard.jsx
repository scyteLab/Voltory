import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Layers, Package, PackageCheck, Plus } from "lucide-react";
import { fetchCategories, fetchProducts } from "../../lib/adminCatalog.js";
import { LOW_STOCK_AT, stockState } from "../../utils/format.js";

/**
 * Deliberately only shows numbers Phase 1 actually has (products,
 * stock, categories) — no Revenue/Orders/Warranty cards, since those
 * data sources don't exist yet. Faking them would be worse than not
 * showing them.
 */
export default function AdminDashboard() {
  const [products, setProducts] = useState(null);
  const [categoryCount, setCategoryCount] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchCategories()])
      .then(([p, c]) => { setProducts(p); setCategoryCount(c.length); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="adm-error">Couldn't load dashboard data: {error}</p>;
  if (!products) return <p className="adm-loading">Loading…</p>;

  const active = products.filter((p) => p.status === "active").length;
  const lowStock = products.filter((p) => stockState(p.stock) === "low");
  const outOfStock = products.filter((p) => stockState(p.stock) === "out");

  const cards = [
    { label: "Total Products", value: products.length, icon: Package },
    { label: "Active", value: active, icon: PackageCheck },
    { label: "Low Stock", value: lowStock.length, icon: AlertTriangle, warn: lowStock.length > 0 },
    { label: "Categories", value: categoryCount, icon: Layers },
  ];

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div>
          <p className="adm-crumb">Dashboard</p>
          <h1>Dashboard</h1>
          <p className="adm-page__sub">Catalog snapshot — Orders and Revenue connect in a later phase.</p>
        </div>
        <Link to="/admin/products" className="adm-btn adm-btn--primary">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      <div className="adm-stats">
        {cards.map(({ label, value, icon: Icon, warn }) => (
          <div key={label} className={"adm-stat" + (warn ? " adm-stat--warn" : "")}>
            <span className="adm-stat__icon"><Icon size={18} /></span>
            <div>
              <p className="adm-stat__label">{label}</p>
              <p className="adm-stat__value">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="adm-panel">
        <div className="adm-panel__head">
          <h2>Inventory Warnings</h2>
          <Link to="/admin/products">Manage catalog →</Link>
        </div>
        {lowStock.length === 0 && outOfStock.length === 0 ? (
          <p className="adm-empty">Everything's stocked above {LOW_STOCK_AT} units. Nothing needs attention.</p>
        ) : (
          <ul className="adm-warn-list">
            {[...outOfStock, ...lowStock].map((p) => (
              <li key={p.sku}>
                <AlertTriangle size={14} />
                <span>{p.name}</span>
                <b className={p.stock === 0 ? "adm-text-err" : "adm-text-warn"}>
                  {p.stock === 0 ? "Out of stock" : `${p.stock} units left`}
                </b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
