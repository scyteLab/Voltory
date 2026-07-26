import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { ORDER_STATUSES, PAYMENT_LABELS } from "../../config/orderStatus.js";

function naira(n) { return "\u20A6" + Number(n || 0).toLocaleString("en-NG"); }

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const mo  = String(d.getMonth() + 1).padStart(2, "0");
  const yr  = d.getFullYear();
  const hh  = String(d.getHours()).padStart(2, "0");
  const mm  = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${mo}/${yr} ${hh}:${mm}`;
}

const COLUMNS = [
  { key: "id",            label: "Order",     sortable: true,  width: "180px" },
  { key: "customer_name", label: "Customer",  sortable: true,  width: "minmax(200px, 1fr)" },
  { key: "created_at",    label: "Placed",    sortable: true,  width: "140px" },
  { key: "total",         label: "Total",     sortable: true,  width: "110px", align: "right" },
  { key: "payment_method",label: "Payment",   sortable: false, width: "120px" },
  { key: "status",        label: "Status",    sortable: true,  width: "110px" },
  { key: "_open",         label: "",          sortable: false, width: "44px" },
];

export default function OrdersTable({
  rows, total, loading,
  page, pageSize, onPageChange,
  sort, onSortChange,
}) {
  const navigate = useNavigate();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  function handleSort(colKey) {
    if (!COLUMNS.find((c) => c.key === colKey)?.sortable) return;
    if (sort.col === colKey) {
      onSortChange({ col: colKey, dir: sort.dir === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ col: colKey, dir: "asc" });
    }
  }

  return (
    <div className="adm-ptbl">
      <div className="adm-ptbl__wrap" role="table">
        <div
          className="adm-ptbl__head adm-ordtbl__head"
          style={{ gridTemplateColumns: COLUMNS.map((c) => c.width).join(" ") }}
        >
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
          <div className="adm-ptbl__loading">Loading orders…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="adm-ptbl__empty">
            No orders match your filters. Try a wider date range or clear filters.
          </div>
        )}

        <div className="adm-ptbl__body">
          {rows.map((row) => {
            const st = ORDER_STATUSES[row.status] || { label: row.status, chip: "adm-chip--info" };
            return (
              <div
                key={row.id}
                className="adm-ptbl__row"
                onClick={() => navigate(`/admin/orders/${row.id}`)}
                style={{ gridTemplateColumns: COLUMNS.map((c) => c.width).join(" ") }}
              >
                <div className="adm-ptbl__cell">
                  <span className="adm-mono adm-ordid">{row.id}</span>
                </div>

                <div className="adm-ptbl__product-meta">
                  <b>{row.customer_name}</b>
                  <small>{row.customer_phone}</small>
                </div>

                <span className="adm-ptbl__cell">{fmtDate(row.created_at)}</span>
                <span className="adm-ptbl__cell" style={{ textAlign: "right", fontWeight: 700 }}>{naira(row.total)}</span>
                <span className="adm-ptbl__cell">{PAYMENT_LABELS[row.payment_method] || row.payment_method}</span>
                <span className="adm-ptbl__cell">
                  <span className={"adm-chip " + st.chip}>{st.label}</span>
                </span>
                <span className="adm-ptbl__cell" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="adm-icon-btn adm-icon-btn--sm"
                    aria-label={`Open order ${row.id}`}
                    onClick={() => navigate(`/admin/orders/${row.id}`)}
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