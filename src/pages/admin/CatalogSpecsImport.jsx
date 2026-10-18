import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Download,
  FileText, Filter, Info, Loader2, Minus, Upload,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient.js";
import {
  parseCsvFile, validateRows, commitRows, generateTemplateCsv,
  getSubCategoriesForCategory, filterProductsBySubCategory,
  hasSubCategories, MAX_SPEC_SLOTS,
} from "../../lib/specsBulkImport.js";
import ImportDropzone from "../../components/admin/catalog/ImportDropzone.jsx";

const ALL_DB_CATEGORIES_FOR_PICKER = [
  "washing-machines",
  "refrigerators-freezers",
  "air-conditioners",
  "televisions-audio",
  "kitchen-appliances",
  "small-appliances",
  "power-solutions",
  "accessories",
];

export default function CatalogSpecsImport() {
  const navigate = useNavigate();

  const [dbCategory, setDbCategory] = useState("washing-machines");
  const [subCategory, setSubCategory] = useState(null);

  const subCategories = useMemo(
    () => getSubCategoriesForCategory(dbCategory),
    [dbCategory]
  );
  const hasSubs = hasSubCategories(dbCategory);

  const [refs, setRefs]           = useState(null);
  const [refsError, setRefsError] = useState(null);
  const [refsLoading, setRefsLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);

  const [file, setFile]           = useState(null);
  const [parsing, setParsing]     = useState(false);
  const [parseErrors, setParseErrors] = useState(null);
  const [rowsWithVerdict, setRowsWithVerdict] = useState(null);
  const [summary, setSummary]     = useState(null);

  const [showUnchanged, setShowUnchanged] = useState(false);
  const [filterShort, setFilterShort]     = useState(false);
  const [showAll, setShowAll]             = useState(false);

  const [includeWarnings, setIncludeWarnings] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress]     = useState({ done: 0, total: 0 });
  const [result, setResult]         = useState(null);

  useEffect(() => {
    if (hasSubs) {
      const subs = getSubCategoriesForCategory(dbCategory);
      setSubCategory(subs[0] || null);
    } else {
      setSubCategory(null);
    }
  }, [dbCategory, hasSubs]);

  useEffect(() => {
    let cancelled = false;
    setRefs(null);
    setRefsError(null);
    setRefsLoading(true);
    setRowsWithVerdict(null);
    setSummary(null);
    setResult(null);
    setAllProducts([]);

    (async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("sku, name, brand, category, description, specs, highlights")
          .eq("category", dbCategory)
          .eq("status", "active");
        if (error) throw error;
        if (cancelled) return;
        setAllProducts(data || []);
      } catch (err) {
        if (!cancelled) setRefsError(err.message || String(err));
      } finally {
        if (!cancelled) setRefsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [dbCategory]);

  useEffect(() => {
    if (!allProducts) return;
    const filtered = filterProductsBySubCategory(allProducts, dbCategory, subCategory);
    const productsBySku = new Map();
    filtered.forEach((r) => productsBySku.set(r.sku, r));
    setRefs({ productsBySku, products: filtered });
    setRowsWithVerdict(null);
    setSummary(null);
    setResult(null);
    setFile(null);
  }, [allProducts, dbCategory, subCategory]);

  const subCategoryCounts = useMemo(() => {
    const counts = {};
    subCategories.forEach((sub) => {
      counts[sub] = filterProductsBySubCategory(allProducts, dbCategory, sub).length;
    });
    return counts;
  }, [allProducts, dbCategory, subCategories]);

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

  const handleCommit = useCallback(async () => {
    if (!rowsWithVerdict) return;
    setCommitting(true);
    setProgress({ done: 0, total: 0 });
    const res = await commitRows(rowsWithVerdict, {
      includeWarnings,
      onProgress: (done, total) => setProgress({ done, total }),
    });
    setCommitting(false);
    setResult(res);
  }, [rowsWithVerdict, includeWarnings]);

  const handleReset = useCallback(() => {
    setFile(null);
    setParseErrors(null);
    setRowsWithVerdict(null);
    setSummary(null);
    setResult(null);
    setShowAll(false);
    setShowUnchanged(false);
    setFilterShort(false);
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    if (!refs?.products) return;

    const csv = generateTemplateCsv(refs.products);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = subCategory
      ? `naven-specs-${dbCategory}-${subCategory}-${stamp}.csv`
      : `naven-specs-${dbCategory}-${stamp}.csv`;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [refs, dbCategory, subCategory]);

  const shortDescriptionSkus = useMemo(() => {
    if (!refs?.products) return new Set();
    const set = new Set();
    refs.products.forEach((p) => {
      const desc = String(p.description || "").trim();
      if (desc.length < 60) set.add(p.sku);
    });
    return set;
  }, [refs]);

  const visibleRows = useMemo(() => {
    if (!rowsWithVerdict) return null;
    let rows = rowsWithVerdict;
    if (!showUnchanged) {
      rows = rows.filter((r) => r.verdict !== "unchanged");
    }
    if (filterShort) {
      rows = rows.filter((r) => shortDescriptionSkus.has(r.resolved?.sku));
    }
    return rows;
  }, [rowsWithVerdict, showUnchanged, filterShort, shortDescriptionSkus]);

  if (refsLoading) {
    return <div className="adm-page"><div className="hb__loading">Loading catalog reference data…</div></div>;
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

  if (result) {
    return (
      <div className="adm-page">
        <div className="waq-detail__crumbs">
          <Link to="/admin/products"><ArrowLeft size={14} /> Back to products</Link>
        </div>

        <header className="adm-page__head">
          <div>
            <h1>Specs update complete</h1>
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
              onClick={() => navigate("/admin/products")}
            >
              Back to products
            </button>
          </div>
        </div>
      </div>
    );
  }

  const productCount = refs?.products?.length || 0;
  const totalToApply = (summary?.update || 0) + (includeWarnings ? (summary?.warning || 0) : 0);
  const weakCount = shortDescriptionSkus.size;

  return (
    <div className="adm-page">
      <div className="waq-detail__crumbs">
        <Link to="/admin/products"><ArrowLeft size={14} /> Back to products</Link>
      </div>

      <header className="adm-page__head">
        <div>
          <h1>Bulk update specs & descriptions</h1>
          <p>
            Pick a category, download the pre-filled template, edit any spec labels and values per product,
            then upload. The template gives you {MAX_SPEC_SLOTS} freeform spec slots per product — use whatever
            labels fit each product (there is no fixed vocabulary).
          </p>
        </div>
      </header>

      <div className="adm-import__categorybar">
        <label>
          <b>Category:</b>
          <select
            value={dbCategory}
            onChange={(e) => setDbCategory(e.target.value)}
            disabled={!!rowsWithVerdict || committing}
          >
            {ALL_DB_CATEGORIES_FOR_PICKER.map((c) => (
              <option key={c} value={c}>
                {c.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
              </option>
            ))}
          </select>
        </label>

        {hasSubs && subCategories.length > 0 && (
          <label>
            <b>Sub-category:</b>
            <select
              value={subCategory || ""}
              onChange={(e) => setSubCategory(e.target.value)}
              disabled={!!rowsWithVerdict || committing}
            >
              {subCategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
                  {" ("}
                  {subCategoryCounts[sub] || 0}
                  {")"}
                </option>
              ))}
            </select>
          </label>
        )}

        <span className="adm-import__meta">
          {productCount} active product{productCount === 1 ? "" : "s"}
          {weakCount > 0 && (
            <> · <b style={{ color: "#B45309" }}>{weakCount} with weak descriptions</b></>
          )}
        </span>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="adm-btn adm-btn--primary"
          disabled={productCount === 0}
        >
          <Download size={14} /> Download template
        </button>
      </div>

      <details className="adm-import__help" open={!rowsWithVerdict}>
        <summary><Info size={14} /> How this works</summary>
        <ol>
          <li>Pick category and (optionally) sub-category above.</li>
          <li>Click <b>Download template</b> — the CSV comes pre-filled with every product's current description, highlights, and specs.</li>
          <li>Each product has <b>{MAX_SPEC_SLOTS} spec slots</b> — each slot has a label column and a value column (<code>new_spec_1_label</code>, <code>new_spec_1_value</code>, etc).</li>
          <li>Fill specs in any order you want — the order you use in the CSV is the display order on the product page.</li>
          <li>Use any label vocabulary — the system doesn't force standardization. "Capacity (kg)" and "Washing Capacity" are both fine, pick what matches the product's spec sheet.</li>
          <li><b>To add a spec</b>: fill both <code>new_spec_N_label</code> and <code>new_spec_N_value</code> in any empty slot.</li>
          <li><b>To change a spec</b>: edit the <code>new_spec_N_label</code> or <code>new_spec_N_value</code> cell.</li>
          <li><b>To remove a spec</b>: clear both label and value cells for that slot.</li>
          <li><b>Highlights</b>: separate bullets with the pipe character <code>|</code>. Example: <code>Glass Lid | Soft Close | Pump | Turbo</code></li>
          <li>Empty slots are ignored. Rows where nothing changed are skipped automatically.</li>
          <li><b>Save as CSV UTF-8</b> in Excel (not plain CSV) to preserve special characters like （） and ×.</li>
          <li>Drop the file below, review the preview, choose whether to include overwrite warnings, then commit.</li>
        </ol>
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
              <span>clean updates</span>
            </div>
            <div className="adm-import__sumcard adm-import__sumcard--warn">
              <b>{summary.warning}</b>
              <span>overwrite warnings</span>
            </div>
            <div className="adm-import__sumcard">
              <b>{summary.descChanged}</b>
              <span>description changes</span>
            </div>
            <div className="adm-import__sumcard">
              <b>{summary.hlChanged}</b>
              <span>highlights changes</span>
            </div>
            <div className="adm-import__sumcard">
              <b>{summary.specsChanged}</b>
              <span>products with spec changes</span>
            </div>
            <div className="adm-import__sumcard">
              <b>+{summary.specsAdded}</b>
              <span>specs added</span>
            </div>
            <div className="adm-import__sumcard">
              <b>−{summary.specsRemoved}</b>
              <span>specs removed</span>
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

          {summary.warning > 0 && (
            <div className="adm-import__warn" style={{ background: "#FEF3C7", borderLeftColor: "#B45309", color: "#78350F" }}>
              <AlertTriangle size={14} />
              {summary.warning} row{summary.warning === 1 ? " would overwrite" : "s would overwrite"} existing non-empty content or remove specs.
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 12 }}>
                <input
                  type="checkbox"
                  checked={includeWarnings}
                  onChange={(e) => setIncludeWarnings(e.target.checked)}
                />
                <span>Include warnings in update</span>
              </label>
            </div>
          )}

          <div className="adm-import__filterbar">
            <span><Filter size={13} /> Filters:</span>
            <label>
              <input
                type="checkbox"
                checked={showUnchanged}
                onChange={(e) => setShowUnchanged(e.target.checked)}
              />
              <span>Show unchanged rows</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={filterShort}
                onChange={(e) => setFilterShort(e.target.checked)}
              />
              <span>Only products with weak current descriptions ({weakCount})</span>
            </label>
          </div>

          <SpecsPreviewTable
            rows={visibleRows}
            showAll={showAll}
            onShowAll={() => setShowAll(true)}
            shortDescriptionSkus={shortDescriptionSkus}
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

const INITIAL_LIMIT = 50;

function SpecsPreviewTable({ rows, showAll, onShowAll, shortDescriptionSkus }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="adm-import__preview adm-import__preview--empty">
        No rows to display. Try toggling filters or upload a different file.
      </div>
    );
  }
  const visible = showAll ? rows : rows.slice(0, INITIAL_LIMIT);
  const truncated = rows.length > INITIAL_LIMIT && !showAll;

  return (
    <div className="adm-import__preview">
      <table className="adm-import__table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th style={{ width: 110 }}>Verdict</th>
            <th>SKU</th>
            <th>Name</th>
            <th>Changes</th>
            <th>Warnings / Errors</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.rowIndex} className={"adm-import__row adm-import__row--" + r.verdict}>
              <td className="mono adm-import__num">{r.rowIndex + 2}</td>
              <td>{verdictPill(r.verdict)}</td>
              <td className="mono">
                {r.resolved?.sku || r.row?.sku || "—"}
                {shortDescriptionSkus.has(r.resolved?.sku) && (
                  <span className="adm-import__weakflag" title="Current description is short or weak">
                    <FileText size={10} /> weak
                  </span>
                )}
              </td>
              <td>{r.row?.name || "—"}</td>
              <td>
                {r.changes.length > 0 ? (
                  <ul className="adm-import__changes">
                    {r.resolved?.descriptionChanged && (
                      <li>Description ({r.resolved.descriptionLength} chars)</li>
                    )}
                    {r.resolved?.highlightsChanged && (
                      <li>Highlights ({(r.resolved.updates.highlights || []).length} bullets)</li>
                    )}
                    {r.resolved?.specsChanged && (
                      <li>
                        Specs: {r.resolved.specsAddedCount > 0 && `+${r.resolved.specsAddedCount} added`}
                        {r.resolved.specsAddedCount > 0 && r.resolved.specsChangedCount > 0 && ", "}
                        {r.resolved.specsChangedCount > 0 && `${r.resolved.specsChangedCount} changed`}
                        {(r.resolved.specsAddedCount > 0 || r.resolved.specsChangedCount > 0) && r.resolved.specsRemovedCount > 0 && ", "}
                        {r.resolved.specsRemovedCount > 0 && `−${r.resolved.specsRemovedCount} removed`}
                      </li>
                    )}
                  </ul>
                ) : (
                  <span style={{ color: "var(--adm-ink-3)" }}>—</span>
                )}
              </td>
              <td className="adm-import__errors">
                {r.errors.length > 0 && (
                  <ul>{r.errors.map((e, i) => <li key={"e" + i}>{e}</li>)}</ul>
                )}
                {r.warnings.length > 0 && (
                  <ul className="adm-import__warnlist">
                    {r.warnings.slice(0, 3).map((w, i) => <li key={"w" + i}>{w}</li>)}
                    {r.warnings.length > 3 && <li>… and {r.warnings.length - 3} more</li>}
                  </ul>
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
  if (v === "update") {
    return <span className="revs__status revs__status--approved"><CheckCircle2 size={11} /> Update</span>;
  }
  if (v === "warning") {
    return <span className="revs__status" style={{ background: "#FEF3C7", color: "#78350F" }}>
      <AlertTriangle size={11} /> Warning
    </span>;
  }
  if (v === "unchanged") {
    return <span className="revs__status" style={{ background: "var(--adm-bg-2, #f0f2f5)", color: "var(--adm-ink-3, #6a6f78)" }}>
      <Minus size={11} /> Unchanged
    </span>;
  }
  return <span className="revs__status revs__status--rejected"><AlertCircle size={11} /> Error</span>;
}
