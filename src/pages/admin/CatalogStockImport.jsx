import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, ArrowDown, ArrowUp, CheckCircle2, Download,
  Info, Loader2, Minus, Upload,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient.js";
import {
  parseCsvFile, validateRows, commitRows, TEMPLATE_CSV, COLUMNS,
} from "../../lib/stockBulkImport.js";
import ImportDropzone from "../../components/admin/catalog/ImportDropzone.jsx";

/**
 * CatalogStockImport — /admin/inventory/update
 *
 * Weekly stock refresh via a 2-column CSV: sku, stock.
 * SKUs must already exist; missing ones surface as errors.
 *
 * Design mirrors CatalogProductsImport for consistency, but the
 * preview is scoped to what actually matters here — the delta
 * between current stock and new stock.
 */
export default function CatalogStockImport() {
  const navigate = useNavigate();

  const [refs, setRefs]           = useState(null);
  const [refsError, setRefsError] = useState(null);
  const [refsLoading, setRefsLoading] = useState(true);

  const [file, setFile]           = useState(null);
  const [parsing, setParsing]     = useState(false);
  const [parseErrors, setParseErrors] = useState(null);
  const [rowsWithVerdict, setRowsWithVerdict] = useState(null);
  const [summary, setSummary]     = useState(null);
  const [showAll, setShowAll]     = useState(false);

  const [committing, setCommitting] = useState(false);
  const [progress, setProgress]     = useState({ done: 0, total: 0 });
  const [result, setResult]         = useState(null);

  /* ---------- load reference data ---------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from("products").select("sku, stock");
        if (error) throw error;
        if (cancelled) return;

        const existingSkus = new Set();
        const currentStockBySku = new Map();
        (data || []).forEach((r) => {
          existingSkus.add(r.sku);
          currentStockBySku.set(r.sku, Number(r.stock) || 0);
        });

        setRefs({ existingSkus, currentStockBySku });
      } catch (err) {
        if (!cancelled) setRefsError(err.message || String(err));
      } finally {
        if (!cancelled) setRefsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---------- parse + validate ---------- */

  const handleFile = useCallback(async (f) => {
    setFile(f);
    setParsing(true);
    setParseErrors(null);
    setRowsWithVerdict(null);
    setSummary(null);
    setResult(null);

    const parseRes = await parseCsvFile(f);
    if (!parseRes.ok) {
      setParseErrors(parseRes.errors);
      setParsing(false);
      return;
    }
    if (!refs) {
      setParseErrors([{ message: "Reference data still loading. Try again in a moment." }]);
      setParsing(false);
      return;
    }
    const { rowsWithVerdict: rwv, summary: s } = validateRows(parseRes.rows, refs);
    setRowsWithVerdict(rwv);
    setSummary(s);
    setParsing(false);
  }, [refs]);

  /* ---------- commit ---------- */

  const handleCommit = useCallback(async () => {
    if (!rowsWithVerdict) return;
    setCommitting(true);
    setProgress({ done: 0, total: 0 });
    const res = await commitRows(rowsWithVerdict, (done, total) => setProgress({ done, total }));
    setCommitting(false);
    setResult(res);
  }, [rowsWithVerdict]);

  /* ---------- reset ---------- */

  const handleReset = useCallback(() => {
    setFile(null);
    setParseErrors(null);
    setRowsWithVerdict(null);
    setSummary(null);
    setResult(null);
    setShowAll(false);
  }, []);

  /* ---------- download template ---------- */

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "naven-stock-update-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  /* ---------- render ---------- */

  if (refsLoading) {
    return <div className="adm-page"><div className="hb__loading">Loading catalog reference data…</div></div>;
  }
  if (refsError) {
    return (
      <div className="adm-page">
        <div className="hb__err">Couldn't load reference data: {refsError}</div>
        <Link to="/admin/inventory" className="adm-btn adm-btn--secondary">
          <ArrowLeft size={14} /> Back to inventory
        </Link>
      </div>
    );
  }

  /* -------- RESULT SCREEN -------- */

  if (result) {
    return (
      <div className="adm-page">
        <div className="waq-detail__crumbs">
          <Link to="/admin/inventory"><ArrowLeft size={14} /> Back to inventory</Link>
        </div>

        <header className="adm-page__head">
          <div>
            <h1>Stock update complete</h1>
          </div>
        </header>

        <div className="adm-import__result">
          <div className="adm-import__result-grid">
            <div className="adm-import__stat adm-import__stat--good">
              <CheckCircle2 size={22} />
              <div>
                <b>{result.updated}</b>
                <span>products updated</span>
              </div>
            </div>
            <div className="adm-import__stat adm-import__stat--warn">
              <AlertCircle size={22} />
              <div>
                <b>{result.errors.length}</b>
                <span>row{result.errors.length === 1 ? "" : "s"} failed</span>
              </div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="adm-import__result-errors">
              <h3>Errors from the database</h3>
              <ul>
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.rowIndex + 2} ({e.sku || "—"}): {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="adm-import__result-actions">
            <button type="button" className="adm-btn adm-btn--secondary" onClick={handleReset}>
              Update more
            </button>
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              onClick={() => navigate("/admin/inventory")}
            >
              Back to inventory
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------- MAIN SCREEN -------- */

  const totalToApply = summary?.update || 0;

  return (
    <div className="adm-page">
      <div className="waq-detail__crumbs">
        <Link to="/admin/inventory"><ArrowLeft size={14} /> Back to inventory</Link>
      </div>

      <header className="adm-page__head">
        <div>
          <h1>Bulk update stock</h1>
          <p>Upload a small CSV (SKU + new stock) to refresh inventory across many products at once. Great after receiving a shipment.</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="adm-btn adm-btn--secondary"
        >
          <Download size={14} /> Download template
        </button>
      </header>

      <details className="adm-import__help" open={!rowsWithVerdict}>
        <summary><Info size={14} /> How this works</summary>
        <ol>
          <li>Download the template CSV above — just two columns: <b>sku, stock</b>.</li>
          <li>Fill one row per product you want to update. Only SKUs already in your catalog will work.</li>
          <li>Save as CSV, drop it below, review the delta preview, then click Update.</li>
          <li>The new stock value REPLACES the old one — this is not "add 5 more," it's "set stock to 5."</li>
          <li>Products not listed in the CSV are left alone.</li>
        </ol>
        <div className="adm-import__cols">
          <b>Columns:</b>
          <table>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.key}>
                  <td className="mono">{c.key}</td>
                  <td>{c.required ? <b>required</b> : "optional"}</td>
                  <td>{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {!rowsWithVerdict && (
        <ImportDropzone onFile={handleFile} disabled={parsing} />
      )}

      {parsing && (
        <div className="hb__loading">
          <Loader2 size={16} className="waq-spin" /> Parsing and validating…
        </div>
      )}

      {parseErrors && (
        <div className="hb__err">
          {parseErrors.map((e, i) => <div key={i}>{e.message}</div>)}
          <div style={{ marginTop: 8 }}>
            <button type="button" className="adm-btn adm-btn--secondary" onClick={handleReset}>
              Try another file
            </button>
          </div>
        </div>
      )}

      {rowsWithVerdict && summary && (
        <>
          <div className="adm-import__summary">
            <div className="adm-import__sumcard adm-import__sumcard--good">
              <b>{summary.update}</b>
              <span>to update</span>
            </div>
            <div className="adm-import__sumcard">
              <b>{summary.up}</b>
              <span>going up</span>
            </div>
            <div className="adm-import__sumcard">
              <b>{summary.down}</b>
              <span>going down</span>
            </div>
            <div className="adm-import__sumcard">
              <b>{summary.unchanged}</b>
              <span>unchanged</span>
            </div>
            <div className="adm-import__sumcard adm-import__sumcard--warn">
              <b>{summary.error}</b>
              <span>with errors</span>
            </div>
          </div>

          {summary.error > 0 && (
            <div className="adm-import__warn">
              <AlertCircle size={14} />
              {summary.error} row{summary.error === 1 ? " has" : "s have"} errors and will be skipped.
              Fix them in the CSV and re-upload, or proceed to update only the valid rows.
            </div>
          )}

          <StockPreviewTable
            rows={rowsWithVerdict}
            showAll={showAll}
            onShowAll={() => setShowAll(true)}
          />

          <div className="adm-import__commit">
            {committing ? (
              <>
                <div className="adm-import__progress">
                  <div
                    className="adm-import__progress-bar"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p>Updating… {progress.done} / {progress.total}</p>
              </>
            ) : (
              <>
                <button type="button" className="adm-btn adm-btn--secondary" onClick={handleReset}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--primary"
                  onClick={handleCommit}
                  disabled={totalToApply === 0}
                >
                  <Upload size={14} /> Update {totalToApply} product{totalToApply === 1 ? "" : "s"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Small local preview table — different columns from the product
   import preview, so kept inline rather than sharing.
   ============================================================ */

const INITIAL_LIMIT = 100;

function StockPreviewTable({ rows, showAll, onShowAll }) {
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
            <th style={{ textAlign: "right" }}>Current</th>
            <th style={{ textAlign: "right" }}>New</th>
            <th style={{ textAlign: "right" }}>Delta</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.rowIndex} className={"adm-import__row adm-import__row--" + r.verdict}>
              <td className="mono adm-import__num">{r.rowIndex + 2}</td>
              <td>{verdictPill(r.verdict)}</td>
              <td className="mono">{r.resolved?.sku || r.row.sku || "—"}</td>
              <td style={{ textAlign: "right" }} className="mono">
                {Number.isFinite(r.resolved?.currentStock) ? r.resolved.currentStock : "—"}
              </td>
              <td style={{ textAlign: "right" }} className="mono">
                <b>{r.resolved?.stock ?? "—"}</b>
              </td>
              <td style={{ textAlign: "right" }}>{deltaCell(r.resolved?.delta)}</td>
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
  if (v === "update") return <span className="revs__status revs__status--approved"><CheckCircle2 size={11} /> Update</span>;
  return <span className="revs__status revs__status--rejected"><AlertCircle size={11} /> Error</span>;
}

function deltaCell(delta) {
  if (delta == null) return <span style={{ color: "var(--adm-ink-3)" }}>—</span>;
  if (delta === 0)   return <span style={{ color: "var(--adm-ink-3)", display: "inline-flex", alignItems: "center", gap: 3 }}><Minus size={11} /> 0</span>;
  if (delta > 0)     return <span style={{ color: "#047857", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><ArrowUp size={11} /> +{delta}</span>;
  return <span style={{ color: "#b91c1c", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><ArrowDown size={11} /> {delta}</span>;
}