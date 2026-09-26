import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, Boxes, Calendar, CheckCircle2, Download, Info, Loader2,
  Package, ShoppingBag, Tag,
} from "lucide-react";
import { exportStockDump, exportPriceDump, exportSalesDump } from "../../lib/dataExports.js";

/**
 * AdminExports \u2014 /admin/exports
 *
 * Three CSV download buttons for detailed business analysis.
 * Each dump is generated live from Supabase (no stale caches).
 *
 * Stock dump  \u2014 all products, current stock, category, brand
 * Price dump  \u2014 all products, current prices, discounts
 * Sales dump  \u2014 all orders as one row per line item (pivot-ready)
 *
 * Sales dump has an optional date-range filter for scoped exports
 * (e.g. "Q3 2026 sales only" for financial reporting).
 */
export default function AdminExports() {
  const [busy, setBusy] = useState(null);         /* "stock" | "price" | "sales" | null */
  const [lastResult, setLastResult] = useState(null);
  const [error, setError] = useState(null);

  const [salesStart, setSalesStart] = useState("");
  const [salesEnd, setSalesEnd]     = useState("");

  async function run(kind, fn) {
    setBusy(kind);
    setError(null);
    setLastResult(null);
    try {
      const res = await fn();
      if (res.ok) {
        setLastResult({ kind, ...res });
      } else {
        setError(res.error || "Export failed. Try again.");
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(null);
    }
  }

  const handleStock = () => run("stock", () => exportStockDump());
  const handlePrice = () => run("price", () => exportPriceDump());
  const handleSales = () => run("sales", () => exportSalesDump({
    startDate: salesStart || undefined,
    endDate:   salesEnd   || undefined,
  }));

  return (
    <div className="adm-page">
      <div className="waq-detail__crumbs">
        <Link to="/admin"><ArrowLeft size={14} /> Back to dashboard</Link>
      </div>

      <header className="adm-page__head">
        <div>
          <h1>Data Exports</h1>
          <p>Download live snapshots of your catalog and sales data for analysis in Excel, Google Sheets, or your accounting software.</p>
        </div>
      </header>

      {error && (
        <div className="hb__err" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {lastResult && (
        <div className="adm-import__warn" style={{ background: "#e6f7ee", borderLeftColor: "#047857", color: "#065f46", marginBottom: 16 }}>
          <CheckCircle2 size={16} />
          <b>Downloaded.</b>{" "}
          {lastResult.kind === "sales"
            ? `${lastResult.count} line items across ${lastResult.orderCount} orders.`
            : `${lastResult.count} products.`}
        </div>
      )}

      <div className="exports-grid">
        {/* ============ STOCK ============ */}
        <div className="exports-card">
          <div className="exports-card__icon exports-card__icon--stock">
            <Boxes size={22} />
          </div>
          <h3>Stock Report</h3>
          <p>
            All products with current stock levels, categorised by brand and category.
            Perfect for warehouse reconciliation and physical inventory checks.
          </p>
          <ul className="exports-card__fields">
            <li>SKU, name, brand, category</li>
            <li>Current stock</li>
            <li>Current price, compare-at price</li>
            <li>Status (active/inactive)</li>
            <li>Last updated timestamp</li>
          </ul>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={handleStock}
            disabled={busy !== null}
          >
            {busy === "stock"
              ? <><Loader2 size={14} className="waq-spin" /> Generating\u2026</>
              : <><Download size={14} /> Download stock CSV</>}
          </button>
        </div>

        {/* ============ PRICE ============ */}
        <div className="exports-card">
          <div className="exports-card__icon exports-card__icon--price">
            <Tag size={22} />
          </div>
          <h3>Price Report</h3>
          <p>
            All products with current prices, compare-at prices, discount percentages,
            and customer savings. Useful for competitor analysis and pricing reviews.
          </p>
          <ul className="exports-card__fields">
            <li>SKU, name, brand, category</li>
            <li>Current price</li>
            <li>Compare-at (original) price</li>
            <li>Discount % and customer savings</li>
            <li>Status, last updated</li>
          </ul>
          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={handlePrice}
            disabled={busy !== null}
          >
            {busy === "price"
              ? <><Loader2 size={14} className="waq-spin" /> Generating\u2026</>
              : <><Download size={14} /> Download price CSV</>}
          </button>
        </div>

        {/* ============ SALES ============ */}
        <div className="exports-card exports-card--wide">
          <div className="exports-card__icon exports-card__icon--sales">
            <ShoppingBag size={22} />
          </div>
          <h3>Sales Report</h3>
          <p>
            Detailed sales dump with one row per line item \u2014 optimised for Excel pivot tables
            and financial analysis. Order-level fields (customer, delivery, totals) are repeated
            per line so grouping and filtering works cleanly.
          </p>
          <ul className="exports-card__fields">
            <li>Order ID, date, time, status</li>
            <li>Payment method, status, Paystack ref</li>
            <li>Customer name, phone, email</li>
            <li>Delivery state, LGA, street, landmark</li>
            <li>SKU, product name, qty, unit price, line total</li>
            <li>Order subtotal, discount, delivery fee, installation fee, total</li>
          </ul>

          <details className="exports-daterange">
            <summary><Calendar size={13} /> Filter by date range (optional)</summary>
            <div className="exports-daterange__grid">
              <label>
                <span>From</span>
                <input
                  type="date"
                  value={salesStart}
                  onChange={(e) => setSalesStart(e.target.value)}
                  disabled={busy !== null}
                />
              </label>
              <label>
                <span>To</span>
                <input
                  type="date"
                  value={salesEnd}
                  onChange={(e) => setSalesEnd(e.target.value)}
                  disabled={busy !== null}
                />
              </label>
            </div>
            <p className="exports-daterange__hint">
              <Info size={12} /> Leave blank to export ALL orders (all time).
            </p>
          </details>

          <button
            type="button"
            className="adm-btn adm-btn--primary"
            onClick={handleSales}
            disabled={busy !== null}
          >
            {busy === "sales"
              ? <><Loader2 size={14} className="waq-spin" /> Generating\u2026</>
              : <><Download size={14} /> Download sales CSV</>}
          </button>
        </div>
      </div>

      <details className="adm-import__help" style={{ marginTop: 20 }}>
        <summary><Info size={14} /> Format notes</summary>
        <ul>
          <li>All CSVs are UTF-8 encoded with a BOM prefix \u2014 the \u20A6 Naira symbol renders correctly in Excel.</li>
          <li>Filenames include today's date so you can archive multiple snapshots.</li>
          <li>Sales dump uses "one row per line item" format \u2014 best for Excel pivot tables.</li>
          <li>All data is fetched live from Supabase at download time \u2014 no stale caches.</li>
          <li>Only ADMIN users can access this page (protected by AdminGuard).</li>
        </ul>
      </details>
    </div>
  );
}