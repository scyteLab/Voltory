import { Search, X } from "lucide-react";
import { ORDER_STATUSES } from "../../config/orderStatus.js";

/**
 * Filter row for the Orders list. Same shape as CatalogFilters
 * so the admin looks consistent — search on the left, selects, then
 * active-filter chips + total count on the second line.
 */
export default function OrdersFilters({ filters, onChange, total }) {
  function patch(next) { onChange({ ...filters, ...next, page: 1 }); }

  const activeChips = [];
  if (filters.search)   activeChips.push({ key: "search",   label: `Search: "${filters.search}"` });
  if (filters.status)   activeChips.push({ key: "status",   label: `Status: ${ORDER_STATUSES[filters.status]?.label || filters.status}` });
  if (filters.dateFrom) activeChips.push({ key: "dateFrom", label: `From: ${filters.dateFrom}` });
  if (filters.dateTo)   activeChips.push({ key: "dateTo",   label: `To: ${filters.dateTo}` });

  function clearAll() {
    onChange({ ...filters, search: "", status: "", dateFrom: "", dateTo: "", page: 1 });
  }

  return (
    <div className="adm-catfilter">
      <div className="adm-catfilter__row adm-ordfilter__row">
        <label className="adm-catfilter__search">
          <Search size={15} />
          <input
            type="search"
            value={filters.search || ""}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Search by order ID, customer, or phone…"
          />
        </label>

        <select
          value={filters.status || ""}
          onChange={(e) => patch({ status: e.target.value })}
          className="adm-select"
          aria-label="Filter by status"
        >
          <option value="">All Status</option>
          {Object.entries(ORDER_STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <input
          type="date"
          value={filters.dateFrom || ""}
          onChange={(e) => patch({ dateFrom: e.target.value })}
          className="adm-select"
          aria-label="From date"
          title="From date"
        />

        <input
          type="date"
          value={filters.dateTo || ""}
          onChange={(e) => patch({ dateTo: e.target.value })}
          className="adm-select"
          aria-label="To date"
          title="To date"
        />
      </div>

      {(activeChips.length > 0 || total > 0) && (
        <div className="adm-catfilter__meta">
          <span className="adm-catfilter__count">
            {total.toLocaleString()} order{total === 1 ? "" : "s"} matching
          </span>
          {activeChips.length > 0 && (
            <>
              <ul className="adm-catfilter__chips">
                {activeChips.map((chip) => (
                  <li key={chip.key}>
                    <button
                      onClick={() => patch({ [chip.key]: "" })}
                      className="adm-catfilter__chip"
                    >
                      {chip.label} <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
              <button onClick={clearAll} className="adm-catfilter__clear">
                Clear all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}