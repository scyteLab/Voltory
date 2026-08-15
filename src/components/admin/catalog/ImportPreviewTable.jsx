import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { naira } from "../../../utils/format.js";

/**
 * ImportPreviewTable — dense table showing every parsed row with
 * its verdict. Errors surface with red left border + a reason;
 * updates get a subtle blue tint; new creates are plain.
 *
 * Only shows the first N rows if the file is huge (keeps DOM light);
 * user can toggle to show all.
 */
const INITIAL_LIMIT = 100;

export default function ImportPreviewTable({ rows, showAll, onShowAll }) {
  if (!rows || rows.length === 0) return null;

  const visible = showAll ? rows : rows.slice(0, INITIAL_LIMIT);
  const truncated = rows.length > INITIAL_LIMIT && !showAll;

  return (
    <div className="adm-import__preview">
      <table className="adm-import__table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th style={{ width: 80 }}>Verdict</th>
            <th>SKU</th>
            <th>Name</th>
            <th>Brand</th>
            <th>Category</th>
            <th style={{ textAlign: "right" }}>Price</th>
            <th style={{ textAlign: "right" }}>Stock</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.rowIndex} className={"adm-import__row adm-import__row--" + r.verdict}>
              <td className="mono adm-import__num">{r.rowIndex + 2}</td>
              <td>{verdictPill(r.verdict)}</td>
              <td className="mono">{r.resolved?.sku || r.row.sku || "—"}</td>
              <td className="adm-import__truncate">{r.resolved?.name || r.row.name || "—"}</td>
              <td>{r.row.brand || "—"}</td>
              <td>{r.row.category || "—"}</td>
              <td style={{ textAlign: "right" }}>
                {r.resolved?.price ? naira(r.resolved.price) : "—"}
              </td>
              <td style={{ textAlign: "right" }}>{r.resolved?.stock ?? "—"}</td>
              <td className="adm-import__errors">
                {r.errors.length > 0 && (
                  <ul>{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {truncated && (
        <div className="adm-import__truncate-notice">
          Showing first {INITIAL_LIMIT} of {rows.length} rows.
          {" "}
          <button type="button" className="adm-btn adm-btn--secondary" onClick={onShowAll}>
            Show all rows
          </button>
        </div>
      )}
    </div>
  );
}

function verdictPill(v) {
  if (v === "create") return <span className="revs__status revs__status--approved"><CheckCircle2 size={11} /> Create</span>;
  if (v === "update") return <span className="revs__status revs__status--pending"><Pencil size={11} /> Update</span>;
  return <span className="revs__status revs__status--rejected"><AlertTriangle size={11} /> Error</span>;
}