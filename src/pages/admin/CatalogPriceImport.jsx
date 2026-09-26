import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, ArrowDown, ArrowUp, CheckCircle2, Download,
  Info, Loader2, Minus, Upload,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient.js";
import {
  parseCsvFile, validateRows, commitRows, generateTemplateCsv,
  TEMPLATE_CSV, COLUMNS,
} from "../../lib/priceBulkImport.js";
import ImportDropzone from "../../components/admin/catalog/ImportDropzone.jsx";
import { naira } from "../../utils/format.js";

/**
 * CatalogPriceImport \u2014 /admin/pricing/update
 *
 * Bulk price refresh via a pre-filled CSV. Mirrors the stock update
 * page pattern for admin muscle-memory consistency.
 *
 * SAFETY: only updates price + was columns. Never touches stock,
 * images, or anything else.
 */
export default function CatalogPriceImport() {
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
  const [showUnchanged, setShowUnchanged] = useState(false);

  const [committing, setCommitting] = useState(false);
  const [progress, setProgress]     = useState({ done: 0, total: 0 });
  const [result, setResult]         = useState(null);

  /* ---------- load reference data ---------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("sku, name, brand, price, was, status")
          .eq("status", "active");
        if (error) throw error;
        if (cancelled) return;

        const existingSkus = new Set();
        const currentPriceBySku = new Map();
        const currentWasBySku = new Map();
        const templateRows = [];
        (data || []).forEach((r) => {
          existingSkus.add(r.sku);
          currentPriceBySku.set(r.sku, Number(r.price) || 0);
          currentWasBySku.set(r.sku, r.was == null ? null : Number(r.was));
          templateRows.push({
            sku: r.sku,
            name: r.name,
            brand: r.brand,
            price: Number(r.price) || 0,
            was: r.was == null ? null : Number(r.was),
          });
        });

        setRefs({ existingSkus, currentPriceBySku, currentWasBySku, templateRows });
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
    setShowUnchanged(false);
  }, []);

  /* ---------- download template ---------- */

  const handleDownloadTemplate = useCallback(() => {
    const csv = refs?.templateRows?.length > 0
      ? generateTemplateCsv(refs.templateRows)
      : TEMPLATE_CSV;

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `naven-price-update-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [refs]);

  /* ---------- render ---------- */

  if (refsLoading) {
    return <div className="adm-page"><div className="hb__loading">Loading catalog reference data\u2026</div></div>;
  }
  if (refsError) {
    return (
      <div className="adm-page">
        <div className="hb__err">Couldn't load reference data: {refsError}</div>
        <Link to="/admin/products" className="adm-btn adm-btn--secondary">
          <ArrowLeft size={14} /> Back to products
        </Link>
      </div>
    );
  }

  /* -------- RESULT SCREEN -------- */

  if (result) {
    return (
      <div className="adm-page">
        <div className="waq-detail__crumbs">
          <Link to="/admin/products"><ArrowLeft size={14} /> Back to products</Link>
        </div>

        <header className="adm-page__head">
          <div>
            <h1>Price update complete</h1>
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
                    Row {e.rowIndex + 2} ({e.sku || "\u2014"}): {e.message}
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
              onClick={() => navigate("/admin/products")}
            >
              Back to products
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------- MAIN SCREEN -------- */

  const totalToApply = summary?.update || 0;
  const productCount = refs?.templateRows?.length || 0;

  const visibleRows = rowsWithVerdict
    ? (showUnchanged ? rowsWithVerdict : rowsWithVerdict.filter((r) => r.verdict !== "unchanged"))
    : null;

  return (
    <div className="adm-page">
      <div className="waq-detail__crumbs">
        <Link to="/admin/products"><ArrowLeft size={14} /> Back to products</Link>
      </div>

      <header className="adm-page__head">
        <div>
          <h1>Bulk update prices</h1>
          <p>Download the pre-filled template with all {productCount} active products, edit the <b>new_price</b> and <b>new_was</b> columns for the products whose prices changed, then upload. Only rows with actual changes are applied.</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="adm-btn adm-btn--primary"
        >
          <Download size={14} /> Download template ({productCount} products)
        </button>
      </header>

      <details className="adm-import__help" open={!rowsWithVerdict}>
        <summary><Info size={14} /> How this works</summary>
        <ol>
          <li>Click <b>Download template</b> above \u2014 the CSV comes pre-filled with every active product's current price and compare-at price.</li>
          <li>Open in Excel. Filter or sort by brand/category to find the products you need to reprice.</li>
          <li>Edit the <b>new_price</b> column (and optionally <b>new_was</b>) for whatever products changed.</li>
          <li>Leave everything else unchanged \u2014 products where prices didn't change are silently skipped.</li>
          <li><b>new_was</b> is the crossed-out original price. Leave blank for no discount. Must be higher than new_price.</li>
          <li>Save as CSV, drop it below, review the preview, then click Update.</li>
          <li>Stock, product images, names, and everything else are NEVER touched by this upload.</li>
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
          <Loader2 size={16} className="waq-spin" /> Parsing and validating\u2026
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
              <b>{summary.priceUp}</b>
              <span>going up</span>
            </div>
            <div className="adm-import__sumcard">
              <b>{summary.priceDown}</b>
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

          {summary.unchanged > 0 && !showUnchanged && (
            <div className="adm-import__warn" style={{ background: "var(--adm-bg-2, #f7f8fa)", borderLeftColor: "var(--adm-ink-3, #6a6f78)" }}>
              <Info size={14} />
              {summary.unchanged} row{summary.unchanged === 1 ? " is" : "s are"} unchanged and hidden from preview.
              {" "}
              <button
                type="button"
                className="adm-btn adm-btn--secondary adm-btn--sm"
                onClick={() => setShowUnchanged(true)}
                style={{ marginLeft: 8 }}
              >
                Show them
              </button>
            </div>
          )}

          <PricePreviewTable
            rows={visibleRows}
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
                <p>Updating\u2026 {progress.done} / {progress.total}</p>
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
   Preview table
   ============================================================ */

const INITIAL_LIMIT = 100;

function PricePreviewTable({ rows, showAll, onShowAll }) {
  if (!rows || rows.length === 0) return null;
  const visible = showAll ? rows : rows.slice(0, INITIAL_LIMIT);
  const truncated = rows.length > INITIAL_LIMIT && !showAll;

  return (
    <div className="adm-import__preview">
      <table className="adm-import__table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th style={{ width: 100 }}>Verdict</th>
            <th>SKU</th>
            <th>Name</th>
            <th style={{ textAlign: "right" }}>Current Price</th>
            <th style={{ textAlign: "right" }}>New Price</th>
            <th style={{ textAlign: "right" }}>Delta</th>
            <th style={{ textAlign: "right" }}>New Was</th>
            <th>Errors</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.rowIndex} className={"adm-import__row adm-import__row--" + r.verdict}>
              <td className="mono adm-import__num">{r.rowIndex + 2}</td>
              <td>{verdictPill(r.verdict)}</td>
              <td className="mono">{r.resolved?.sku || r.row.sku || "\u2014"}</td>
              <td>{r.row?.name || "\u2014"}</td>
              <td style={{ textAlign: "right" }} className="mono">
                {Number.isFinite(r.resolved?.currentPrice) ? naira(r.resolved.currentPrice) : "\u2014"}
              </td>
              <td style={{ textAlign: "right" }} className="mono">
                <b>{Number.isFinite(r.resolved?.price) ? naira(r.resolved.price) : "\u2014"}</b>
              </td>
              <td style={{ textAlign: "right" }}>
                {priceDeltaCell(r.resolved?.price, r.resolved?.currentPrice)}
              </td>
              <td style={{ textAlign: "right" }} className="mono">
                {r.resolved?.was == null
                  ? <span style={{ color: "var(--adm-ink-3)" }}>\u2014</span>
                  : naira(r.resolved.was)}
              </td>
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
  if (v === "update")    return <span className="revs__status revs__status--approved"><CheckCircle2 size={11} /> Update</span>;
  if (v === "unchanged") return <span className="revs__status" style={{ background: "var(--adm-bg-2, #f0f2f5)", color: "var(--adm-ink-3, #6a6f78)" }}><Minus size={11} /> Unchanged</span>;
  return <span className="revs__status revs__status--rejected"><AlertCircle size={11} /> Error</span>;
}

function priceDeltaCell(newPrice, currentPrice) {
  if (!Number.isFinite(newPrice) || !Number.isFinite(currentPrice)) {
    return <span style={{ color: "var(--adm-ink-3)" }}>\u2014</span>;
  }
  const delta = newPrice - currentPrice;
  if (delta === 0) {
    return <span style={{ color: "var(--adm-ink-3)", display: "inline-flex", alignItems: "center", gap: 3 }}><Minus size={11} /> 0</span>;
  }
  if (delta > 0) {
    return <span style={{ color: "#047857", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><ArrowUp size={11} /> +{naira(delta)}</span>;
  }
  return <span style={{ color: "#b91c1c", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}><ArrowDown size={11} /> {naira(Math.abs(delta))}</span>;
}