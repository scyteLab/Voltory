import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown, ArrowUp, Award, ChevronLeft, ChevronRight,
  ExternalLink, RefreshCw, Search, Sparkles, User, X,
} from "lucide-react";
import { useCustomers } from "../../hooks/useCustomers.js";

function naira(n) { return "\u20A6" + Number(n || 0).toLocaleString("en-NG"); }
function fmtDate(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const TAG_META = {
  vip:      { label: "VIP",      cls: "adm-chip--info",  icon: Award,    accent: "info" },
  repeat:   { label: "Repeat",   cls: "adm-chip--ok",    icon: Sparkles, accent: "ok" },
  new:      { label: "New",      cls: "adm-chip--warn",  icon: User,     accent: "warn" },
  standard: { label: "Customer", cls: "adm-chip--info",  icon: User,     accent: "info" },
};

const COLUMNS = [
  { key: "name",           label: "Customer",     sortable: true,  width: "minmax(220px, 1.4fr)" },
  { key: "phone",          label: "Phone",        sortable: true,  width: "150px" },
  { key: "order_count",    label: "Orders",       sortable: true,  width: "90px",  align: "right" },
  { key: "total_spent",    label: "Spent",        sortable: true,  width: "130px", align: "right" },
  { key: "last_order_at",  label: "Last Order",   sortable: true,  width: "120px" },
  { key: "tag",            label: "Tag",          sortable: true,  width: "110px" },
  { key: "_open",          label: "",             sortable: false, width: "44px" },
];

export default function AdminCustomers() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: "", tag: "",
    sort: { col: "last_order_at", dir: "desc" },
    page: 1, pageSize: 20,
  });

  const { rows, total, loading, error, refresh } = useCustomers(filters);
  const totalPages = Math.max(1, Math.ceil(total / (filters.pageSize || 20)));
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
  if (filters.tag)    activeChips.push({ key: "tag",    label: `Tag: ${TAG_META[filters.tag]?.label || filters.tag}` });

  return (
    <div className="adm-page adm-customers">
      <header className="adm-page__head">
        <div>
          <h1>Customers</h1>
          <p>Everyone who has placed an order. Grouped by phone number.</p>
        </div>
        <button className="adm-btn adm-btn--secondary" onClick={refresh}>
          <RefreshCw size={13} /> Refresh
        </button>
      </header>

      <div className="adm-catfilter">
        <div className="adm-catfilter__row adm-custfilter__row">
          <label className="adm-catfilter__search">
            <Search size={15} />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => patch({ search: e.target.value })}
              placeholder="Search by name, phone, or email…"
            />
          </label>
          <select
            value={filters.tag}
            onChange={(e) => patch({ tag: e.target.value })}
            className="adm-select"
            aria-label="Filter by tag"
          >
            <option value="">All Tags</option>
            <option value="vip">VIP</option>
            <option value="repeat">Repeat</option>
            <option value="new">New</option>
            <option value="standard">Standard</option>
          </select>
        </div>

        {(activeChips.length > 0 || total > 0) && (
          <div className="adm-catfilter__meta">
            <span className="adm-catfilter__count">
              {total.toLocaleString()} customer{total === 1 ? "" : "s"} matching
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
                <button onClick={() => patch({ search: "", tag: "" })} className="adm-catfilter__clear">
                  Clear all
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="adm-empty adm-empty--err">
          <b>Failed to load customers.</b>
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
                  style={c.align ? { textAlign: c.align } : undefined}
                >
                  {c.label}
                  {isSorted && (filters.sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                </button>
              );
            })}
          </div>

          {loading && rows.length === 0 && (
            <div className="adm-ptbl__loading">Loading customers…</div>
          )}
          {!loading && rows.length === 0 && (
            <div className="adm-ptbl__empty">
              No customers match your filters yet.
            </div>
          )}

          <div className="adm-ptbl__body">
            {rows.map((row) => {
              const tag = TAG_META[row.tag] || TAG_META.standard;
              const TagIcon = tag.icon;
              return (
                <div
                  key={row.phone}
                  className="adm-ptbl__row"
                  onClick={() => navigate(`/admin/customers/${encodeURIComponent(row.phone)}`)}
                  style={{ gridTemplateColumns: COLUMNS.map((c) => c.width).join(" ") }}
                >
                  <div className="adm-ptbl__product">
                    <span className="adm-ptbl__thumb">
                      <span className="adm-cust__initial">{(row.name || "?")[0].toUpperCase()}</span>
                    </span>
                    <div className="adm-ptbl__product-meta">
                      <b>{row.name || "Unnamed"}</b>
                      <small>{row.email || "\u2014 no email"}</small>
                    </div>
                  </div>

                  <span className="adm-ptbl__cell adm-mono">{row.phone}</span>
                  <span className="adm-ptbl__cell" style={{ textAlign: "right", fontWeight: 700 }}>
                    {row.order_count}
                  </span>
                  <span className="adm-ptbl__cell" style={{ textAlign: "right", fontWeight: 700 }}>
                    {naira(row.total_spent)}
                  </span>
                  <span className="adm-ptbl__cell">{fmtDate(row.last_order_at)}</span>
                  <span className="adm-ptbl__cell">
                    <span className={"adm-chip " + tag.cls}>
                      <TagIcon size={11} /> {tag.label}
                    </span>
                  </span>
                  <span className="adm-ptbl__cell" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="adm-icon-btn adm-icon-btn--sm"
                      aria-label={`Open ${row.name}`}
                      onClick={() => navigate(`/admin/customers/${encodeURIComponent(row.phone)}`)}
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