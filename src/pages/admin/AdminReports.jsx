import { useMemo, useState } from "react";
import {
  AlertTriangle, Banknote, Download, FileSpreadsheet, Package,
  RefreshCw, ShoppingCart, Trophy,
} from "lucide-react";
import { exportTableToCsv, useReports } from "../../hooks/useReports.js";
import { ORDER_STATUSES } from "../../config/orderStatus.js";

function naira(n) { return "\u20A6" + Number(n || 0).toLocaleString("en-NG"); }

/**
 * Reports page.
 *
 * Three widgets:
 *   1. Sales revenue chart (SVG polyline over N days, with headline stats)
 *   2. Top selling products (top 10 by units)
 *   3. Orders by status (bar-ish breakdown)
 *
 * Plus a downloads block for orders / customers CSV export.
 */
export default function AdminReports() {
  const [rangeDays, setRangeDays] = useState(30);
  const [tick, setTick] = useState(0);
  const { loading, error, data } = useReports(rangeDays, tick);
  const [exporting, setExporting] = useState(null); // "orders" | "customers"
  const [exportMsg, setExportMsg] = useState(null);

  async function doExport(kind) {
    setExporting(kind);
    setExportMsg(null);
    try {
      if (kind === "orders") {
        const res = await exportTableToCsv({
          table: "orders",
          columns: [
            "id", "created_at", "status", "customer_name", "customer_phone",
            "customer_email", "payment_method", "subtotal", "discount",
            "delivery_fee", "installation_fee", "total",
          ],
          filename: `voltory-orders-${todayStamp()}.csv`,
          orderBy: { col: "created_at", dir: "desc" },
        });
        setExportMsg(`Exported ${res.rows} orders \u2014 check your Downloads folder.`);
      } else if (kind === "customers") {
        const res = await exportTableToCsv({
          table: "customers_summary",
          columns: [
            "phone", "name", "email", "order_count", "active_orders",
            "total_spent", "first_order_at", "last_order_at", "tag",
          ],
          filename: `voltory-customers-${todayStamp()}.csv`,
          orderBy: { col: "last_order_at", dir: "desc" },
        });
        setExportMsg(`Exported ${res.rows} customers \u2014 check your Downloads folder.`);
      }
    } catch (e) {
      setExportMsg(`Export failed: ${e.message || String(e)}`);
    } finally {
      setExporting(null);
      setTimeout(() => setExportMsg(null), 5000);
    }
  }

  return (
    <div className="adm-page adm-reports">
      <header className="adm-page__head">
        <div>
          <h1>Reports</h1>
          <p>Revenue trends, top-selling products, and order breakdowns.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            className="adm-select"
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
            style={{ width: 160 }}
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 365 days</option>
          </select>
          <button className="adm-btn adm-btn--secondary" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="adm-empty adm-empty--err">
          <AlertTriangle size={32} />
          <b>Could not load reports.</b>
          <p>{error}</p>
        </div>
      )}

      {loading && !data && (
        <div className="adm-empty adm-empty--loading">Loading reports…</div>
      )}

      {data && (
        <>
          {/* SALES CHART */}
          <section className="adm-widget">
            <header>
              <div>
                <b>Revenue Trend</b>
                <small>Last {data.rangeDays} days · excludes cancellations</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: "20px 22px" }}>
              <div className="adm-rep__totals">
                <div>
                  <span className="adm-rep__totals-label">Total Revenue</span>
                  <span className="adm-rep__totals-value">
                    <Banknote size={16} /> {naira(data.totalRevenue)}
                  </span>
                </div>
                <div>
                  <span className="adm-rep__totals-label">Order Count</span>
                  <span className="adm-rep__totals-value">
                    <ShoppingCart size={16} /> {data.orderCount}
                  </span>
                </div>
                <div>
                  <span className="adm-rep__totals-label">Avg. Order Value</span>
                  <span className="adm-rep__totals-value">
                    {naira(data.orderCount > 0 ? Math.round(data.totalRevenue / data.orderCount) : 0)}
                  </span>
                </div>
              </div>
              <SalesChart data={data.daily} />
            </div>
          </section>

          {/* TWO-COL: top products + status breakdown */}
          <div className="adm-two-col">
            <section className="adm-widget">
              <header>
                <div>
                  <b>Top Selling Products</b>
                  <small>By units sold, all-time</small>
                </div>
              </header>
              <div className="adm-widget__body" style={{ padding: 0 }}>
                {data.topProducts.length === 0
                  ? <div className="adm-widget__empty">No sales yet.</div>
                  : (
                    <ol className="adm-rep__top">
                      {data.topProducts.slice(0, 10).map((p, i) => (
                        <li key={p.sku}>
                          <span className="adm-rep__rank">{i === 0 ? <Trophy size={13} /> : i + 1}</span>
                          <div className="adm-rep__prodmeta">
                            <b>{p.product_name}</b>
                            <small>SKU <span className="adm-mono">{p.sku}</span> · {p.order_count} order{p.order_count === 1 ? "" : "s"}</small>
                          </div>
                          <span className="adm-rep__units">{p.units_sold} sold</span>
                          <span className="adm-rep__revenue">{naira(p.revenue)}</span>
                        </li>
                      ))}
                    </ol>
                  )
                }
              </div>
            </section>

            <section className="adm-widget">
              <header>
                <div>
                  <b>Orders by Status</b>
                  <small>All-time distribution</small>
                </div>
              </header>
              <div className="adm-widget__body" style={{ padding: "16px 22px" }}>
                <StatusBreakdown data={data.statusBreakdown} />
              </div>
            </section>
          </div>

          {/* EXPORT */}
          <section className="adm-widget">
            <header>
              <div>
                <b>Downloads</b>
                <small>CSV exports for your records or offline analysis</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: "16px 22px" }}>
              <div className="adm-rep__exports">
                <button
                  className="adm-quick"
                  disabled={exporting === "orders"}
                  onClick={() => doExport("orders")}
                >
                  <FileSpreadsheet size={20} />
                  <span>{exporting === "orders" ? "Exporting\u2026" : "Export Orders (CSV)"}</span>
                </button>
                <button
                  className="adm-quick"
                  disabled={exporting === "customers"}
                  onClick={() => doExport("customers")}
                >
                  <Download size={20} />
                  <span>{exporting === "customers" ? "Exporting\u2026" : "Export Customers (CSV)"}</span>
                </button>
              </div>
              {exportMsg && (
                <p className="adm-rep__exportmsg">{exportMsg}</p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Simple SVG line chart. No dependency. Responsive width via
 * preserveAspectRatio, fixed viewBox.
 */
function SalesChart({ data }) {
  const w = 800, h = 200, padL = 44, padR = 12, padT = 16, padB = 28;
  if (!data.length) return <div className="adm-widget__empty">No sales data.</div>;

  const values = data.map((d) => d.revenue);
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;

  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const step = iw / (data.length - 1 || 1);

  const path = data
    .map((d, i) => {
      const x = padL + i * step;
      const y = padT + ih * (1 - (d.revenue - min) / range);
      return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
    })
    .join(" ");
  const areaPath = `${path} L ${padL + (data.length - 1) * step},${padT + ih} L ${padL},${padT + ih} Z`;

  const yTicks = 4;
  const yValues = Array.from({ length: yTicks + 1 }, (_, i) => (max / yTicks) * i);
  const xTickEvery = Math.max(1, Math.floor(data.length / 6));

  return (
    <div className="adm-rep__chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Revenue trend">
        {/* Y grid */}
        {yValues.map((v, i) => {
          const y = padT + ih * (1 - v / range);
          return <line key={i} x1={padL} x2={w - padR} y1={y} y2={y} className="adm-rep__grid" />;
        })}
        {/* Y labels */}
        {yValues.map((v, i) => {
          const y = padT + ih * (1 - v / range);
          return (
            <text key={i} x={padL - 6} y={y + 3} textAnchor="end" className="adm-rep__ylabel">
              {v >= 1_000_000 ? `\u20A6${(v / 1_000_000).toFixed(1)}M` :
               v >= 1_000     ? `\u20A6${Math.round(v / 1_000)}k` :
                                `\u20A6${Math.round(v)}`}
            </text>
          );
        })}
        {/* X labels */}
        {data.map((d, i) => {
          if (i % xTickEvery !== 0 && i !== data.length - 1) return null;
          const x = padL + i * step;
          const parts = d.day.split("-"); // YYYY-MM-DD
          const label = `${parts[2]}/${parts[1]}`;
          return (
            <text key={d.day} x={x} y={h - 10} textAnchor="middle" className="adm-rep__xlabel">
              {label}
            </text>
          );
        })}
        {/* Area + line */}
        <path d={areaPath} className="adm-rep__area" />
        <path d={path} className="adm-rep__line" />
        {/* Dots */}
        {data.map((d, i) => {
          const x = padL + i * step;
          const y = padT + ih * (1 - (d.revenue - min) / range);
          if (d.revenue === 0) return null;
          return <circle key={d.day} cx={x} cy={y} r="2.4" className="adm-rep__dot" />;
        })}
      </svg>
    </div>
  );
}

/**
 * Orders-by-status stacked bar breakdown. Just an HTML bar since we
 * only need proportional widths, no interactivity.
 */
function StatusBreakdown({ data }) {
  const total = data.reduce((s, r) => s + Number(r.count || 0), 0);
  if (!total) return <div className="adm-widget__empty">No orders yet.</div>;

  return (
    <div className="adm-rep__breakdown">
      <div className="adm-rep__bar" role="img" aria-label="Orders by status">
        {data.map((row) => {
          const meta = ORDER_STATUSES[row.status];
          if (!meta) return null;
          const pct = (row.count / total) * 100;
          return (
            <span
              key={row.status}
              className={"adm-rep__bar-seg adm-rep__bar-seg--" + meta.tone}
              style={{ flexBasis: `${pct}%` }}
              title={`${meta.label}: ${row.count}`}
            />
          );
        })}
      </div>
      <ul className="adm-rep__legend">
        {data.map((row) => {
          const meta = ORDER_STATUSES[row.status];
          if (!meta) return null;
          const pct = ((row.count / total) * 100).toFixed(1);
          return (
            <li key={row.status}>
              <span className={"adm-rep__legend-dot adm-rep__bar-seg--" + meta.tone} />
              <span className="adm-rep__legend-label">{meta.label}</span>
              <b>{row.count}</b>
              <small>({pct}%)</small>
            </li>
          );
        })}
      </ul>
    </div>
  );
}