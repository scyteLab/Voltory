import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight,
  ExternalLink, RefreshCw, Search, X,
} from "lucide-react";
import { useWarranty } from "../../hooks/useWarranty.js";
import { WARRANTY_STATUSES } from "../../config/warrantyStatus.js";

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const COLUMNS = [
  { key: "id",            label: "Claim",     sortable: true,  width: "180px" },
  { key: "customer_name", label: "Customer",  sortable: true,  width: "170px" },
  { key: "reason",        label: "Reason",    sortable: false, width: "minmax(240px, 1fr)" },
  { key: "created_at",    label: "Submitted", sortable: true,  width: "130px" },
  { key: "status",        label: "Status",    sortable: true,  width: "110px" },
  { key: "_open",         label: "",          sortable: false, width: "44px" },
];

export default function AdminWarranty() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: "", status: "",
    sort: { col: "created_at", dir: "desc" },
    page: 1, pageSize: 15,
  });

  const { rows, total, loading, error, refresh } = useWarranty(filters);
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize || 15)));
  const start = total === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1;
  const end = Math.min(total, filters.page * filters.pageSize);

  function patch(next) { setFilters((f) => ({ ...f, ...next, page: 1 })); }
  function handleSort(col) {
    const meta = COLUMNS.find((c) => c.key === col);
    if (!meta?.sortable) return;
    setFilters((f) => ({
      ...f,
      sort: f.sort.col === col
        ? { col, dir: f.sort.dir === "asc" ? "desc" : "asc" }
        : { col, dir: "asc" },
      page: 1,
    }));
  }

  const activeChips = [];
  if (filters.search) activeChips.push({ key: "search", label: `Search: "${filters.search}"` });
  if (filters.status) activeChips.push({ key: "status", label: `Status: ${WARRANTY_STATUSES[filters.status]?.label || filters.status}` });

  return (
    <div className="adm-page adm-warranty">
      <header className="adm-page__head">
        <div>
          <h1>Warranty Claims</h1>
          <p>Review and process customer warranty submissions across all products and brands.</p>
        </div>
        <button className="adm-btn adm-btn--secondary" onClick={refresh}>
          <RefreshCw size={13} /> Refresh
        </button>
      </header>

      <div className="adm-catfilter">
        <div className="adm-catfilter__row adm-warrfilter__row">
          <label className="adm-catfilter__search">
            <Search size={15} />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => patch({ search: e.target.value })}
              placeholder="Search by claim ID, customer, phone, or reason…"
            />
          </label>
          <select
            value={filters.status}
            onChange={(e) => patch({ status: e.target.value })}
            className="adm-select"
          >
            <option value="">All Statuses</option>
            {Object.entries(WARRANTY_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {(activeChips.length > 0 || total > 0) && (
          <div className="adm-catfilter__meta">
            <span className="adm-catfilter__count">
              {total.toLocaleString()} claim{total === 1 ? "" : "s"} matching
            </span>
            {activeChips.length > 0 && (
              <>
                <ul className="adm-catfilter__chips">
                  {activeChips.map((chip) => (
                    <li key={chip.key}>
                      <button onClick={() => patch({ [chip.key]: "" })} className="adm-catfilter__chip">
                        {chip.label} <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button onClick={() => patch({ search: "", status: "" })} className="adm-catfilter__clear">
                  Clear all
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="adm-empty adm-empty--err">
          <b>Failed to load warranty claims.</b>
          <p>{error}</p>
          <button className="adm-btn adm-btn--secondary" onClick={refresh}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      <div className="adm-ptbl">
        <div className="adm-ptbl__wrap" role="table">
          <div
            className="adm-ptbl__head"
            style={{ gridTemplateColumns: COLUMNS.map((c) => c.width).join(" ") }}
          >
            {COLUMNS.map((c) => {
              const isSorted = filters.sort.col === c.key;
              return (
                <button
                  key={c.key} type="button"
                  className={"adm-ptbl__th" + (c.sortable ? " adm-ptbl__th--sortable" : "") + (isSorted ? " adm-ptbl__th--on" : "")}
                  onClick={() => handleSort(c.key)}
                >
                  {c.label}
                  {isSorted && (filters.sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </button>
              );
            })}
          </div>

          {loading && rows.length === 0 && (
            <div className="adm-ptbl__loading">Loading warranty claims…</div>
          )}
          {!loading && rows.length === 0 && (
            <div className="adm-ptbl__empty">
              No warranty claims match your filters.
            </div>
          )}

          <div className="adm-ptbl__body">
            {rows.map((row) => {
              const st = WARRANTY_STATUSES[row.status] || { label: row.status, chip: "adm-chip--info" };
              return (
                <div
                  key={row.id}
                  className="adm-ptbl__row"
                  onClick={() => navigate(`/admin/warranty/${row.id}`)}
                  style={{ gridTemplateColumns: COLUMNS.map((c) => c.width).join(" ") }}
                >
                  <span className="adm-mono adm-ordid">{row.id}</span>
                  <div className="adm-ptbl__product-meta">
                    <b>{row.customer_name}</b>
                    <small>{row.customer_phone}</small>
                  </div>
                  <span className="adm-ptbl__cell adm-warr__reason">{row.reason}</span>
                  <span className="adm-ptbl__cell">{fmtDate(row.created_at)}</span>
                  <span className="adm-ptbl__cell">
                    <span className={"adm-chip " + st.chip}>{st.label}</span>
                  </span>
                  <span className="adm-ptbl__cell" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="adm-icon-btn adm-icon-btn--sm"
                      onClick={() => navigate(`/admin/warranty/${row.id}`)}
                      aria-label={`Open claim ${row.id}`}
                    >
                      <ExternalLink size={13} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="adm-ptbl__foot">
          <span className="adm-ptbl__count">
            Showing <b>{start}</b>–<b>{end}</b> of <b>{total.toLocaleString()}</b>
          </span>
          <div className="adm-ptbl__pager">
            <button
              className="adm-btn adm-btn--secondary"
              onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
              disabled={filters.page <= 1}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="adm-ptbl__page">Page <b>{filters.page}</b> of <b>{totalPages}</b></span>
            <button
              className="adm-btn adm-btn--secondary"
              onClick={() => setFilters((f) => ({ ...f, page: Math.min(totalPages, f.page + 1) }))}
              disabled={filters.page >= totalPages}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}