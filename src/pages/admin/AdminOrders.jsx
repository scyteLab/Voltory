import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useOrders } from "../../hooks/useOrders.js";
import OrdersFilters from "../../components/admin/OrdersFilters.jsx";
import OrdersTable from "../../components/admin/OrdersTable.jsx";

/**
 * Admin Orders list. Simple orchestration — filters + table.
 * Click a row to open /admin/orders/:id.
 */
export default function AdminOrders() {
  const [filters, setFilters] = useState({
    search: "", status: "", dateFrom: "", dateTo: "",
    sort: { col: "created_at", dir: "desc" },
    page: 1, pageSize: 15,
  });

  const { rows, total, loading, error, refresh } = useOrders(filters);

  return (
    <div className="adm-page adm-orders">
      <header className="adm-page__head">
        <div>
          <h1>Orders</h1>
          <p>Manage order fulfillment, status transitions, refunds, and customer contact.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="adm-btn adm-btn--secondary" onClick={refresh}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      <OrdersFilters filters={filters} onChange={setFilters} total={total} />

      {error && (
        <div className="adm-empty adm-empty--err">
          <b>Failed to load orders.</b>
          <p>{error}</p>
          <button className="adm-btn adm-btn--secondary" onClick={refresh}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      <OrdersTable
        rows={rows}
        total={total}
        loading={loading}
        page={filters.page}
        pageSize={filters.pageSize}
        onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
        sort={filters.sort}
        onSortChange={(s) => setFilters((f) => ({ ...f, sort: s, page: 1 }))}
      />
    </div>
  );
}