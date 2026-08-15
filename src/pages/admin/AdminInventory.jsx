import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Package, RefreshCw, Search, Upload, XCircle,
} from "lucide-react";
import { useInventory } from "../../hooks/useInventory.js";
import { LOW_STOCK_THRESHOLD } from "../../lib/inventoryClient.js";
import { naira } from "../../utils/format.js";

/**
 * AdminInventory — /admin/inventory
 *
 * Overview of every active product's stock position. Sorted
 * lowest-first by default so out-of-stock and low-stock items
 * surface at the top for immediate action.
 *
 * Actions from this page:
 *   · See at a glance how many products are out / low / OK
 *   · Filter to just the ones that need attention
 *   · Search by SKU or name
 *   · Jump to bulk update (→ /admin/inventory/update)
 *   · Click into any product to fix its stock manually (→ catalog)
 */
export default function AdminInventory() {
  const inv = useInventory();

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Inventory</h1>
          <p>
            Live stock across your active catalog. Products marked "Low" have fewer than {LOW_STOCK_THRESHOLD} units — restock soon.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="adm-btn adm-btn--secondary" onClick={inv.refresh} disabled={inv.loading}>
            <RefreshCw size={13} /> Refresh
          </button>
          <Link to="/admin/inventory/update" className="adm-btn adm-btn--primary">
            <Upload size={13} /> Bulk update stock
          </Link>
        </div>
      </header>

      {/* Summary strip */}
      <div className="inv-summary">
        <button
          className={"inv-sumcard" + (inv.status === "out" ? " inv-sumcard--on" : "") + " inv-sumcard--out"}
          onClick={() => inv.setStatus(inv.status === "out" ? "all" : "out")}
        >
          <XCircle size={20} />
          <div><b>{inv.counts.out}</b><span>Out of stock</span></div>
        </button>
        <button
          className={"inv-sumcard" + (inv.status === "low" ? " inv-sumcard--on" : "") + " inv-sumcard--low"}
          onClick={() => inv.setStatus(inv.status === "low" ? "all" : "low")}
        >
          <AlertTriangle size={20} />
          <div><b>{inv.counts.low}</b><span>Low stock (&lt;{LOW_STOCK_THRESHOLD})</span></div>
        </button>
        <button
          className={"inv-sumcard" + (inv.status === "ok" ? " inv-sumcard--on" : "") + " inv-sumcard--ok"}
          onClick={() => inv.setStatus(inv.status === "ok" ? "all" : "ok")}
        >
          <CheckCircle2 size={20} />
          <div><b>{inv.counts.ok}</b><span>OK</span></div>
        </button>
        <div className="inv-sumcard inv-sumcard--total">
          <Package size={20} />
          <div><b>{inv.counts.total}</b><span>Total active</span></div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="inv-filters">
        <div className="inv-search">
          <Search size={14} />
          <input
            type="text"
            value={inv.query}
            onChange={(e) => inv.setQuery(e.target.value)}
            placeholder="Search by SKU or name…"
          />
        </div>

        <select value={inv.categoryId} onChange={(e) => inv.setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {inv.facets.categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select value={inv.brand} onChange={(e) => inv.setBrand(e.target.value)}>
          <option value="">All brands</option>
          {inv.facets.brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select value={inv.sort} onChange={(e) => inv.setSort(e.target.value)}>
          <option value="stock-asc">Stock: Low to High</option>
          <option value="stock-desc">Stock: High to Low</option>
          <option value="name-asc">Name: A to Z</option>
          <option value="name-desc">Name: Z to A</option>
        </select>
      </div>

      {inv.error && <div className="hb__err">Couldn't load inventory: {inv.error}</div>}

      {inv.loading && inv.rows.length === 0 ? (
        <div className="hb__loading">Loading inventory…</div>
      ) : inv.rows.length === 0 ? (
        <div className="cat-empty">
          <Package size={40} strokeWidth={1.2} />
          <h2>Nothing matches these filters</h2>
          <p>
            {inv.status !== "all" && "Try changing the status filter, or "}
            clear filters to see everything.
          </p>
          <button className="btn-shop" onClick={() => {
            inv.setStatus("all"); inv.setCategoryId(""); inv.setBrand(""); inv.setQuery("");
          }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="inv-table-wrap">
          <table className="inv-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Brand</th>
                <th>Category</th>
                <th style={{ textAlign: "right" }}>Price</th>
                <th style={{ textAlign: "right" }}>Stock</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inv.rows.map((r) => (
                <tr key={r.sku} className={"inv-row inv-row--" + r.status}>
                  <td className="mono">
                    <Link to={`/admin/products?sku=${encodeURIComponent(r.sku)}`}>
                      {r.sku}
                    </Link>
                  </td>
                  <td className="inv-name">
                    <Link to={`/admin/products?sku=${encodeURIComponent(r.sku)}`}>
                      {r.name}
                    </Link>
                  </td>
                  <td>{r.brand || "—"}</td>
                  <td>{r.categoryId || "—"}</td>
                  <td style={{ textAlign: "right" }}>{naira(r.price)}</td>
                  <td style={{ textAlign: "right" }} className="mono inv-stock">
                    <b>{r.stock}</b>
                  </td>
                  <td>{statusPill(r.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusPill(s) {
  if (s === "out") return <span className="revs__status revs__status--rejected"><XCircle size={11} /> Out</span>;
  if (s === "low") return <span className="revs__status revs__status--pending"><AlertTriangle size={11} /> Low</span>;
  return <span className="revs__status revs__status--approved"><CheckCircle2 size={11} /> OK</span>;
}