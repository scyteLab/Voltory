import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download, Eye, Filter, Printer, Receipt as ReceiptIcon,
  RefreshCw, Search,
} from "lucide-react";
import { supabase, supabaseConfigured } from "../../lib/supabaseClient.js";
import { naira } from "../../utils/format.js";
import { receiptStatus } from "../../lib/receiptCalculator.js";
import { BUSINESS_INFO } from "../../config/businessInfo.js";

/**
 * AdminReceipts \u2014 /admin/receipts
 *
 * Lists every order in the system as a receipt, with search,
 * status filter, and quick access to the receipt detail view.
 *
 * We treat every order as a potential receipt \u2014 the receipt
 * detail page handles the "cancelled" watermark case. Admin
 * needs to see all of them, including cancellations, for real
 * accounting/audit purposes.
 */
export default function AdminReceipts() {
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadOrders() {
    if (!supabaseConfigured) {
      setError("Supabase not configured.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (err) throw err;
      setOrders(data || []);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      /* Status filter */
      if (statusFilter !== "all") {
        const s = receiptStatus({ status: o.status });
        if (s !== statusFilter) return false;
      }
      /* Search across id, name, phone, email */
      if (!q) return true;
      return (
        (o.id || "").toLowerCase().includes(q) ||
        (o.customer_name || "").toLowerCase().includes(q) ||
        (o.customer_phone || "").toLowerCase().includes(q) ||
        (o.customer_email || "").toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  const totalValue = useMemo(
    () => filtered.reduce((sum, o) => sum + (o.total || 0), 0),
    [filtered]
  );
  const paidValue = useMemo(
    () => filtered
      .filter((o) => receiptStatus({ status: o.status }) === "paid")
      .reduce((sum, o) => sum + (o.total || 0), 0),
    [filtered]
  );

  return (
    <div className="adm-page adm-receipts">
      <header className="adm-page__head">
        <div>
          <h1>
            <ReceiptIcon size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />
            Receipts
          </h1>
          <p>
            Every order issued through {BUSINESS_INFO.brandName}. Click any receipt
            to view, print, or resend to the customer.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="adm-btn adm-btn--secondary" onClick={loadOrders} disabled={loading}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      {/* ---- Summary ---- */}
      <div className="adm-receipts__summary">
        <div className="adm-receipts__stat">
          <span>Total receipts</span>
          <b>{filtered.length.toLocaleString()}</b>
        </div>
        <div className="adm-receipts__stat">
          <span>Total value</span>
          <b>{naira(totalValue)}</b>
        </div>
        <div className="adm-receipts__stat">
          <span>Paid value</span>
          <b>{naira(paidValue)}</b>
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="adm-receipts__filters">
        <div className="adm-receipts__search">
          <Search size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt ID, name, phone, or email\u2026"
          />
        </div>
        <div className="adm-receipts__status">
          <Filter size={13} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled / Refunded</option>
          </select>
        </div>
      </div>

      {/* ---- Error state ---- */}
      {error && (
        <div className="adm-empty adm-empty--err">
          <b>Failed to load receipts.</b>
          <p>{error}</p>
          <button className="adm-btn adm-btn--secondary" onClick={loadOrders}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* ---- Loading state ---- */}
      {loading && !error && (
        <div className="adm-empty">
          <p>Loading receipts\u2026</p>
        </div>
      )}

      {/* ---- Empty state ---- */}
      {!loading && !error && filtered.length === 0 && (
        <div className="adm-empty">
          <ReceiptIcon size={32} strokeWidth={1.4} />
          <b>No receipts match your filters.</b>
          <p>Try clearing the search or picking a different status.</p>
        </div>
      )}

      {/* ---- Table ---- */}
      {!loading && !error && filtered.length > 0 && (
        <div className="adm-receipts__tblwrap">
          <table className="adm-receipts__tbl">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Phone</th>
                <th className="adm-receipts__col-right">Total</th>
                <th>Status</th>
                <th className="adm-receipts__col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const status = receiptStatus({ status: o.status });
                return (
                  <tr key={o.id}>
                    <td className="mono">{o.id}</td>
                    <td>
                      {new Date(o.created_at).toLocaleDateString("en-NG", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                    <td>{o.customer_name || <span className="adm-mut">\u2014</span>}</td>
                    <td className="mono">{o.customer_phone}</td>
                    <td className="adm-receipts__col-right">
                      <b>{naira(o.total || 0)}</b>
                    </td>
                    <td>
                      <span className={`adm-receipts__badge adm-receipts__badge--${status}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </td>
                    <td className="adm-receipts__col-actions">
                      <Link
                        to={`/admin/receipts/${o.id}`}
                        className="adm-icon-btn adm-icon-btn--sm"
                        title="View receipt"
                      >
                        <Eye size={14} />
                      </Link>
                      <Link
                        to={`/admin/receipts/${o.id}?print=1`}
                        className="adm-icon-btn adm-icon-btn--sm"
                        title="Print receipt"
                        target="_blank"
                      >
                        <Printer size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}