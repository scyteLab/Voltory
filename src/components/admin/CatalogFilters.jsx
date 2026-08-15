import { Search, X } from "lucide-react";

/**
 * Catalog filter row: search + category + brand + status + stock band.
 * All controlled — the parent (CatalogProducts) owns the filter state
 * and passes it down. This component is dumb / stateless.
 *
 * Active filters render as removable chips beneath the row.
 */
const STATUS_OPTIONS = [
  { value: "",         label: "All Status" },
  { value: "active",   label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const STOCK_OPTIONS = [
  { value: "",    label: "All Stock" },
  { value: "low", label: "Low Stock (≤ 10)" },
  { value: "out", label: "Out of Stock" },
];

export default function CatalogFilters({ filters, onChange, brands, categories, total }) {
  function patch(next) { onChange({ ...filters, ...next, page: 1 }); }

  const activeChips = [];
  if (filters.search)     activeChips.push({ key: "search",     label: `Search: "${filters.search}"` });
  if (filters.categoryId) {
    const cat = categories.find((c) => c.id === filters.categoryId);
    activeChips.push({ key: "categoryId", label: `Category: ${cat?.label || filters.categoryId}` });
  }
  if (filters.brandId) {
    const br = brands.find((b) => b.id === filters.brandId);
    activeChips.push({ key: "brandId", label: `Brand: ${br?.name || filters.brandId}` });
  }
  if (filters.status)     activeChips.push({ key: "status",     label: `Status: ${filters.status}` });
  if (filters.stockBand) {
    const s = STOCK_OPTIONS.find((o) => o.value === filters.stockBand);
    activeChips.push({ key: "stockBand", label: s?.label || filters.stockBand });
  }

  function clearAll() {
    onChange({
      ...filters,
      search: "", categoryId: "", brandId: "", status: "", stockBand: "",
      page: 1,
    });
  }

  return (
    <div className="adm-catfilter">
      <div className="adm-catfilter__row">
        <label className="adm-catfilter__search">
          <Search size={15} />
          <input
            type="search"
            value={filters.search || ""}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Search by name, SKU, or model…"
          />
        </label>

        <select
          value={filters.categoryId || ""}
          onChange={(e) => patch({ categoryId: e.target.value })}
          className="adm-select"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>

        <select
          value={filters.brandId || ""}
          onChange={(e) => patch({ brandId: e.target.value })}
          className="adm-select"
          aria-label="Filter by brand"
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={filters.status || ""}
          onChange={(e) => patch({ status: e.target.value })}
          className="adm-select"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.stockBand || ""}
          onChange={(e) => patch({ stockBand: e.target.value })}
          className="adm-select"
          aria-label="Filter by stock"
        >
          {STOCK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {(activeChips.length > 0 || total > 0) && (
        <div className="adm-catfilter__meta">
          <span className="adm-catfilter__count">
            {total.toLocaleString()} product{total === 1 ? "" : "s"} matching
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