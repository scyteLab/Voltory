import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Banknote, Boxes, ChevronRight, DownloadCloud,
  FileSpreadsheet, LayoutGrid, Package, PackagePlus, PackageSearch,
  RefreshCw, ShieldAlert, ShoppingCart, Tag, TrendingUp,
} from "lucide-react";
import { useDashboardData, computeDelta } from "../../hooks/useDashboardData.js";
import KpiCard from "../../components/admin/KpiCard.jsx";

/**
 * Admin dashboard \u2014 Voltory operator's home page.
 * Matches the mockup: 4 KPI cards, order alerts feed, inventory
 * warnings, quick actions, top selling products. Data is pulled
 * live from Supabase via useDashboardData().
 */

function naira(n) {
  return "\u20A6" + Number(n || 0).toLocaleString("en-NG");
}

function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.round((now - then) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

const STATUS_STYLES = {
  confirmed:  { label: "Confirmed",  cls: "adm-chip--info" },
  processing: { label: "Processing", cls: "adm-chip--warn" },
  shipped:    { label: "Shipped",    cls: "adm-chip--info" },
  delivered:  { label: "Delivered",  cls: "adm-chip--ok" },
  cancelled:  { label: "Cancelled",  cls: "adm-chip--err" },
  refunded:   { label: "Refunded",   cls: "adm-chip--warn" },
};

const WARR_STATUS_STYLES = {
  submitted:    { label: "New",         cls: "adm-chip--warn" },
  under_review: { label: "In Review",   cls: "adm-chip--info" },
  approved:     { label: "Approved",    cls: "adm-chip--ok" },
  rejected:     { label: "Rejected",    cls: "adm-chip--err" },
  resolved:     { label: "Resolved",    cls: "adm-chip--ok" },
};

export default function AdminDashboard() {
  const [tick, setTick] = useState(0);
  const { loading, error, data } = useDashboardData(tick);

  if (loading) {
    return (
      <div className="adm-page">
        <PageHeader />
        <div className="adm-empty adm-empty--loading">Loading dashboard…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="adm-page">
        <PageHeader />
        <div className="adm-empty adm-empty--err">
          <AlertTriangle size={32} />
          <b>Could not load the dashboard.</b>
          <p>{error}</p>
          <button className="adm-btn adm-btn--secondary" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const revenueDelta = computeDelta(k.revenue_this_month, k.revenue_last_month);
  const ordersDelta  = computeDelta(k.orders_this_month,  k.orders_last_month);

  // Turn sales_by_day into a sparkline series
  const revenueSpark = (data.sales || []).map((r) => Number(r.revenue) || 0);
  const ordersSpark  = (data.sales || []).map((r) => Number(r.order_count) || 0);

  return (
    <div className="adm-page">
      <PageHeader onRefresh={() => setTick((t) => t + 1)} />

      {/* ---- KPI row ---- */}
      <section className="adm-kpi-row">
        <KpiCard
          label="Total Revenue"
          value={naira(k.revenue_this_month)}
          icon={Banknote}
          accent="brand"
          delta={revenueDelta}
          sparkline={revenueSpark}
        />
        <KpiCard
          label="Total Orders"
          value={Number(k.orders_this_month || 0).toLocaleString()}
          icon={ShoppingCart}
          accent="info"
          delta={ordersDelta}
          sparkline={ordersSpark}
        />
        <KpiCard
          label="Low Stock Alerts"
          value={Number(k.low_stock_count || 0).toLocaleString()}
          icon={PackageSearch}
          accent="warn"
          delta={k.low_stock_count > 0 ? { pct: k.low_stock_count, direction: "up" } : null}
          deltaLabel="products need reorder"
        />
        <KpiCard
          label="Warranty Claims"
          value={Number(k.open_warranty_claims || 0).toLocaleString()}
          icon={ShieldAlert}
          accent="err"
          delta={
            k.new_warranty_claims_this_month > 0
              ? { pct: k.new_warranty_claims_this_month, direction: "up" }
              : { pct: 0, direction: "flat" }
          }
          deltaLabel="new this month"
        />
      </section>

      {/* ---- Alerts + warnings row ---- */}
      <section className="adm-two-col">
        <Widget
          title="Order Alerts"
          subtitle={`${data.recentOrders.length} recent`}
          empty={data.recentOrders.length === 0}
          emptyText="No recent orders."
          viewAllTo="/admin/orders"
        >
          {data.recentOrders.map((o) => (
            <Link key={o.id} to={`/admin/orders/${o.id}`} className="adm-row-item adm-row-item--link">
              <span className="adm-row-item__key">
                <b>{o.id}</b>
                <small>{o.customer_name}</small>
              </span>
              <span className="adm-row-item__val">{naira(o.total)}</span>
              <span className={"adm-chip " + (STATUS_STYLES[o.status]?.cls || "adm-chip--info")}>
                {STATUS_STYLES[o.status]?.label || o.status}
              </span>
              <small className="adm-row-item__ago">{timeAgo(o.created_at)}</small>
            </Link>
          ))}
        </Widget>

        <Widget
          title="Inventory Warnings"
          subtitle={`${k.low_stock_count || 0} items`}
          empty={data.lowStock.length === 0}
          emptyText="All stock levels healthy."
          viewAllTo="/admin/products"
        >
          {data.lowStock.map((p) => (
            <div key={p.sku} className="adm-row-item">
              <span className="adm-row-item__key">
                <b>{p.name}</b>
                <small>{p.brand} · {p.sku}</small>
              </span>
              <span className="adm-warning-badge">
                <AlertTriangle size={12} /> {p.stock} left
              </span>
            </div>
          ))}
        </Widget>
      </section>

      {/* ---- Warranty + quick actions row ---- */}
      <section className="adm-two-col">
        <Widget
          title="Open Warranty Claims"
          subtitle={`${data.openWarranty.length} open`}
          empty={data.openWarranty.length === 0}
          emptyText="No open warranty claims."
          viewAllTo="/admin/warranty"
        >
          {data.openWarranty.map((w) => (
            <Link key={w.id} to={`/admin/warranty/${w.id}`} className="adm-row-item adm-row-item--link">
              <span className="adm-row-item__key">
                <b>{w.customer_name}</b>
                <small>{w.reason}</small>
              </span>
              <span className={"adm-chip " + (WARR_STATUS_STYLES[w.status]?.cls || "adm-chip--warn")}>
                {WARR_STATUS_STYLES[w.status]?.label || w.status}
              </span>
              <small className="adm-row-item__ago">{timeAgo(w.created_at)}</small>
            </Link>
          ))}
        </Widget>

        <Widget title="Quick Actions" subtitle="One-click shortcuts">
          <div className="adm-quickgrid">
            <QuickAction icon={PackagePlus} label="Add Product"      to="/admin/products?new=1" />
            <QuickAction icon={DownloadCloud} label="Import Products" disabled />
            <QuickAction icon={FileSpreadsheet} label="Export Catalog" disabled />
            <QuickAction icon={LayoutGrid} label="Manage Categories"  disabled />
            <QuickAction icon={Tag} label="Manage Brands"             disabled />
            <QuickAction icon={TrendingUp} label="Bulk Update Prices" disabled />
          </div>
        </Widget>
      </section>

      {/* ---- Catalog totals ---- */}
      <section className="adm-catalog-summary">
        <div className="adm-catalog-summary__cell">
          <span className="adm-catalog-summary__label">Products in catalog</span>
          <span className="adm-catalog-summary__value">
            <Package size={18} /> {Number(k.total_products || 0).toLocaleString()}
          </span>
          <small>{Number(k.total_active_products || 0)} active</small>
        </div>
        <div className="adm-catalog-summary__cell">
          <span className="adm-catalog-summary__label">Out of stock</span>
          <span className="adm-catalog-summary__value">
            <Boxes size={18} /> {Number(k.out_of_stock_count || 0)}
          </span>
          <small>Currently unlistable</small>
        </div>
        <div className="adm-catalog-summary__cell">
          <span className="adm-catalog-summary__label">Pending orders</span>
          <span className="adm-catalog-summary__value">
            <ShoppingCart size={18} /> {Number(k.pending_orders || 0)}
          </span>
          <small>Confirmed or processing</small>
        </div>
        <div className="adm-catalog-summary__cell">
          <span className="adm-catalog-summary__label">Total revenue (all time)</span>
          <span className="adm-catalog-summary__value">
            <Banknote size={18} /> {naira(k.total_revenue)}
          </span>
          <small>{Number(k.total_orders || 0)} completed orders</small>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------
   Small internal components
   ------------------------------------------------------------ */

function PageHeader({ onRefresh }) {
  return (
    <header className="adm-page__head">
      <div>
        <h1>Dashboard</h1>
        <p>Live overview of orders, inventory, warranty, and top movers.</p>
      </div>
      {onRefresh && (
        <button className="adm-btn adm-btn--secondary" onClick={onRefresh}>
          <RefreshCw size={13} /> Refresh
        </button>
      )}
    </header>
  );
}

function Widget({ title, subtitle, children, empty, emptyText, viewAllTo, viewAllDisabled }) {
  return (
    <article className="adm-widget">
      <header>
        <div>
          <b>{title}</b>
          {subtitle && <small>{subtitle}</small>}
        </div>
        {viewAllTo && (
          viewAllDisabled
            ? <span className="adm-widget__viewall adm-widget__viewall--soon">View all <em>Soon</em></span>
            : <Link to={viewAllTo} className="adm-widget__viewall">View all <ChevronRight size={12} /></Link>
        )}
      </header>
      <div className="adm-widget__body">
        {empty
          ? <div className="adm-widget__empty">{emptyText}</div>
          : children}
      </div>
    </article>
  );
}

function QuickAction({ icon: Icon, label, to, disabled }) {
  if (disabled) {
    return (
      <span className="adm-quick adm-quick--soon">
        <Icon size={20} />
        <span>{label}</span>
        <em>Soon</em>
      </span>
    );
  }
  return (
    <Link to={to} className="adm-quick">
      <Icon size={20} />
      <span>{label}</span>
      <ChevronRight size={14} className="adm-quick__chev" />
    </Link>
  );
}