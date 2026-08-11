import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, CheckCircle2, Download, FileText,
  Info, Loader2, RotateCcw, Upload,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient.js";
import {
  parseCsvFile, validateRows, commitRows, TEMPLATE_CSV, COLUMNS,
} from "../../lib/productsBulkImport.js";
import ImportDropzone from "../../components/admin/catalog/ImportDropzone.jsx";
import ImportPreviewTable from "../../components/admin/catalog/ImportPreviewTable.jsx";

/**
 * CatalogProductsImport \u2014 /admin/products/import
 *
 * Flow:
 *   1. Page loads \u2192 fetches reference data (existing SKUs, brand names,
 *      category id\u2194name maps)
 *   2. User drops CSV \u2192 we parse + validate immediately
 *   3. Preview table shown \u2014 counts by verdict at the top
 *   4. User clicks "Import" \u2192 commit runs sequentially, progress bar
 *   5. Summary screen with a Done button back to Catalog Products
 *
 * The whole thing lives in one page component because each step
 * clears the prior state; no complex state machine needed.
 */
export default function CatalogProductsImport() {
  const navigate = useNavigate();

  // Reference data used by the validator. Loaded once on mount.
  const [refs, setRefs]           = useState(null);
  const [refsError, setRefsError] = useState(null);
  const [refsLoading, setRefsLoading] = useState(true);

  // Parse / validate state
  const [file, setFile]           = useState(null);
  const [parsing, setParsing]     = useState(false);
  const [parseErrors, setParseErrors] = useState(null);
  const [rowsWithVerdict, setRowsWithVerdict] = useState(null);
  const [summary, setSummary]     = useState(null);
  const [showAll, setShowAll]     = useState(false);

  // Commit state
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress]     = useState({ done: 0, total: 0 });
  const [result, setResult]         = useState(null);

  /* ---------- load reference data ---------- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [prodRes, brandRes, catRes] = await Promise.all([
          supabase.from("products").select("sku"),
          supabase.from("brands").select("name"),
          supabase.from("categories").select("id, label"),
        ]);
        if (prodRes.error)  throw prodRes.error;
        if (brandRes.error) throw brandRes.error;
        if (catRes.error)   throw catRes.error;
        if (cancelled) return;

        const existingSkus = new Set((prodRes.data || []).map((r) => r.sku));
        const brandNames   = new Set((brandRes.data || []).map((r) => r.name));
        const categoryById = new Map();
        const categoryByName = new Map();
        (catRes.data || []).forEach((r) => {
          categoryById.set(r.id, r.label);
          categoryByName.set((r.label || "").toLowerCase(), r.id);
        });

        setRefs({ existingSkus, brandNames, categoryById, categoryByName });
      } catch (err) {
        if (!cancelled) setRefsError(err.message || String(err));
      } finally {
        if (!cancelled) setRefsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---------- parse ---------- */

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
      // Shouldn't happen \u2014 refs load before the user can pick a file \u2014
      // but guard anyway
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

  /* ---------- template download ---------- */

  // Generate the blob and trigger download at click time. Doing this
  // imperatively (vs. useMemo + <a href>) avoids the React StrictMode
  // double-render revoking the blob URL before the user can click it,
  // which Chrome misreports as "Check internet connection".
  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voltory-product-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Give the browser a beat to start the download before releasing
    // the object URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

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
            <h1>Import complete</h1>
          </div>
        </header>

        <div className="adm-import__result">
          <div className="adm-import__result-grid">
            <div className="adm-import__stat adm-import__stat--good">
              <CheckCircle2 size={22} />
              <div>
                <b>{result.created}</b>
                <span>new products created</span>
              </div>
            </div>
            <div className="adm-import__stat adm-import__stat--info">
              <RotateCcw size={22} />
              <div>
                <b>{result.updated}</b>
                <span>existing products updated</span>
              </div>
            </div>
            <div className="adm-import__stat adm-import__stat--warn">
              <AlertCircle size={22} />
              <div>
                <b>{result.errors.length}</b>
                <span>row{result.errors.length === 1 ? "" : "s"} skipped due to DB errors</span>
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
              Import another file
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

  return (
    <div className="adm-page">
      <div className="waq-detail__crumbs">
        <Link to="/admin/products"><ArrowLeft size={14} /> Back to products</Link>
      </div>

      <header className="adm-page__head">
        <div>
          <h1>Bulk import products</h1>
          <p>Upload a CSV to create or update products in bulk. Existing products (matched by SKU) get updated; new SKUs are inserted.</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="adm-btn adm-btn--secondary"
        >
          <Download size={14} /> Download template
        </button>
      </header>

      {/* Instructions */}
      <details className="adm-import__help" open={!rowsWithVerdict}>
        <summary><Info size={14} /> How this works</summary>
        <ol>
          <li>Download the template CSV above.</li>
          <li>Open it in Excel or Google Sheets. The header row shows the column names \u2014 don't rename them.</li>
          <li>Fill one row per product. Required fields: <b>sku, name, brand, category, price, stock</b>.</li>
          <li><b>Brands and categories must already exist</b> in Catalog. Create them first if any are new.</li>
          <li>Save as CSV, drop it below, review the preview, then click Import.</li>
          <li>Images, highlights, specs, and other rich fields are added per-product via the normal editor after import.</li>
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

      {/* Dropzone */}
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

      {/* Summary + preview */}
      {rowsWithVerdict && summary && (
        <>
          <div className="adm-import__summary">
            <div className="adm-import__sumcard adm-import__sumcard--good">
              <b>{summary.create}</b>
              <span>to create</span>
            </div>
            <div className="adm-import__sumcard adm-import__sumcard--info">
              <b>{summary.update}</b>
              <span>to update</span>
            </div>
            <div className="adm-import__sumcard adm-import__sumcard--warn">
              <b>{summary.error}</b>
              <span>with errors</span>
            </div>
            <div className="adm-import__sumcard">
              <b>{summary.total}</b>
              <span>total rows</span>
            </div>
          </div>

          {summary.error > 0 && (
            <div className="adm-import__warn">
              <AlertCircle size={14} />
              {summary.error} row{summary.error === 1 ? " has" : "s have"} errors and will be skipped.
              Fix them in the CSV and re-upload, or proceed to import only the valid rows.
            </div>
          )}

          <ImportPreviewTable
            rows={rowsWithVerdict}
            showAll={showAll}
            onShowAll={() => setShowAll(true)}
          />

          {/* Commit bar */}
          <div className="adm-import__commit">
            {committing ? (
              <>
                <div className="adm-import__progress">
                  <div
                    className="adm-import__progress-bar"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
                <p>
                  Importing\u2026 {progress.done} / {progress.total}
                </p>
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
                  disabled={summary.create + summary.update === 0}
                >
                  <Upload size={14} /> Import {summary.create + summary.update} product{summary.create + summary.update === 1 ? "" : "s"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}