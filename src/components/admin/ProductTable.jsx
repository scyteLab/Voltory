import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ImageOff, MoreVertical } from "lucide-react";

/**
 * Product table — the left column of the catalog page.
 *
 * Row clicks: open the product in the edit panel.
 * Column headers: click to change sort. Click again to flip direction.
 * Pagination: prev / page numbers / next along the bottom.
 *
 * Selection (bulk actions) is scaffolded via the checkbox column but
 * not fully wired — the parent gets `selectedSkus` state and can act
 * on it when we add bulk actions in a follow-up session.
 */

function naira(n) { return "₦" + Number(n || 0).toLocaleString("en-NG"); }

function stockBand(stock) {
  if (stock === 0) return { label: "Out of Stock", cls: "adm-chip--err", tone: "err" };
  if (stock <= 10) return { label: `Low · ${stock} left`, cls: "adm-chip--warn", tone: "warn" };
  return { label: `In Stock · ${stock} units`, cls: "adm-chip--ok", tone: "ok" };
}

const COLUMNS = [
  { key: "name",    label: "Product",  sortable: true,  width: "minmax(240px, 1fr)" },
  { key: "brand",   label: "Brand",    sortable: true,  width: "120px" },
  { key: "category",label: "Category", sortable: true,  width: "150px" },
  { key: "price",   label: "Price",    sortable: true,  width: "110px", align: "right" },
  { key: "stock",   label: "Stock",    sortable: true,  width: "160px" },
  { key: "status",  label: "Status",   sortable: true,  width: "90px" },
  { key: "_actions",label: "",         sortable: false, width: "44px" },
];

export default function ProductTable({
  rows, total, loading,
  page, pageSize, onPageChange,
  sort, onSortChange,
  focusedSku, onSelectRow,
  selectedSkus, onToggleSelect, onToggleSelectAll,
  brands, categories,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  const brandName = (id) => brands.find((b) => b.id === id)?.name || id;
  const categoryLabel = (id) => categories.find((c) => c.id === id)?.label || id;

  function handleSort(colKey) {
    if (!COLUMNS.find((c) => c.key === colKey)?.sortable) return;
    if (sort.col === colKey) {
      onSortChange({ col: colKey, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ col: colKey, dir: "asc" });
    }
  }

  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectedSkus.has(r.sku));

  return (
    <div className="adm-ptbl">
      <div className="adm-ptbl__wrap" role="table">
        <div
          className="adm-ptbl__head"
          style={{ gridTemplateColumns: `44px ${COLUMNS.map((c) => c.width).join(" ")}` }}
        >
          <span>
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={(e) => onToggleSelectAll(e.target.checked)}
              aria-label="Select all on this page"
            />
          </span>
          {COLUMNS.map((c) => {
            const isSorted = sort.col === c.key;
            return (
              <button
                key={c.key}
                type="button"
                className={"adm-ptbl__th" + (c.sortable ? " adm-ptbl__th--sortable" : "") + (isSorted ? " adm-ptbl__th--on" : "")}
                onClick={() => handleSort(c.key)}
                style={c.align ? { textAlign: c.align } : undefined}
              >
                {c.label}
                {isSorted && (sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
              </button>
            );
          })}
        </div>

        {loading && rows.length === 0 && (
          <div className="adm-ptbl__loading">Loading products…</div>
        )}

        {!loading && rows.length === 0 && (
          <div className="adm-ptbl__empty">
            No products match your filters. Try clearing them or adding a new product.
          </div>
        )}

        <div className="adm-ptbl__body">
          {rows.map((row) => {
            const st = stockBand(row.stock);
            const isSelected = focusedSku === row.sku;
            const isChecked = selectedSkus.has(row.sku);
            return (
              <div
                key={row.sku}
                className={"adm-ptbl__row" + (isSelected ? " adm-ptbl__row--on" : "")}
                onClick={() => onSelectRow(row)}
                style={{ gridTemplateColumns: `44px ${COLUMNS.map((c) => c.width).join(" ")}` }}
              >
                <span onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onToggleSelect(row.sku, e.target.checked)}
                    aria-label={`Select ${row.name}`}
                  />
                </span>

                <div className="adm-ptbl__product">
                  <span className="adm-ptbl__thumb">
                    {row.image
                      ? <img src={row.image} alt="" loading="lazy" onError={(e) => { e.target.style.display = "none"; }} />
                      : <ImageOff size={16} />}
                  </span>
                  <div className="adm-ptbl__product-meta">
                    <b>{row.name}</b>
                    <small>SKU: <span className="adm-mono">{row.sku}</span>{row.model ? ` · ${row.model}` : ""}</small>
                  </div>
                </div>

                <span className="adm-ptbl__cell">{brandName(row.brand)}</span>
                <span className="adm-ptbl__cell">{categoryLabel(row.category)}</span>
                <span className="adm-ptbl__cell" style={{ textAlign: "right", fontWeight: 600 }}>{naira(row.price)}</span>

                <span className="adm-ptbl__cell">
                  <span className={"adm-chip " + st.cls}>{st.label}</span>
                </span>

                <span className="adm-ptbl__cell">
                  <span className={"adm-chip " + (row.status === "active" ? "adm-chip--ok" : "adm-chip--warn")}>
                    {row.status === "active" ? "Active" : "Inactive"}
                  </span>
                </span>

                <span className="adm-ptbl__cell" onClick={(e) => e.stopPropagation()}>
                  <button className="adm-icon-btn adm-icon-btn--sm" aria-label="More">
                    <MoreVertical size={15} />
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
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="adm-ptbl__page">
            Page <b>{page}</b> of <b>{totalPages}</b>
          </span>
          <button
            className="adm-btn adm-btn--secondary"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}