import Papa from "papaparse";
import { supabase } from "./supabaseClient.js";

/**
 * stockBulkImport — CSV parsing + validation + commit for
 * STOCK-ONLY updates. Two columns: sku, stock.
 *
 * Distinct from productsBulkImport because the use case is
 * different: bulk import is for onboarding new products; this
 * one is for weekly stock refreshes after receiving shipments.
 * Different mental model, different tool.
 *
 * Public API mirrors productsBulkImport for consistency:
 *   parseCsvFile(file)           → { ok, rows, errors }
 *   validateRows(rows, refs)     → { rowsWithVerdict, summary }
 *   commitRows(rowsWithVerdict)  → { updated, errors }
 *   TEMPLATE_CSV                 — the download template string
 *   COLUMNS                      — canonical column definitions
 *
 * Verdict values here:
 *   'update'  — the SKU exists, stock will be set to the new value
 *   'error'   — row is unusable
 *
 * There is no 'create' verdict — this tool doesn't create products.
 * If a SKU is missing, the row errors out.
 */

/* ============================================================
   Column definitions
   ============================================================ */

export const COLUMNS = [
  { key: "sku",   required: true, type: "text", note: "Product code that already exists in the catalog" },
  { key: "stock", required: true, type: "int",  note: "New stock quantity (non-negative integer)" },
];

const HEADER_ORDER = COLUMNS.map((c) => c.key);

/* ============================================================
   Template
   ============================================================ */

export const TEMPLATE_CSV =
  HEADER_ORDER.join(",") + "\n" +
  [
    "SF-REF-350L",  // example SKU that presumably exists
    "12",           // new stock count
  ].join(",") + "\n" +
  [
    "MID-AC-15HP",
    "5",
  ].join(",");

/* ============================================================
   Parse
   ============================================================ */

export function parseCsvFile(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => (h || "").trim().toLowerCase(),
      transform: (v) => (v == null ? "" : String(v).trim()),
      complete: (result) => {
        const rows = result.data || [];
        const errors = result.errors || [];
        const gotHeaders = Object.keys(rows[0] || {});
        const missing = HEADER_ORDER.filter((h) =>
          COLUMNS.find((c) => c.key === h && c.required)
        ).filter((h) => !gotHeaders.includes(h));
        if (missing.length > 0) {
          resolve({
            ok: false,
            rows: [],
            errors: [{ message: `CSV is missing required columns: ${missing.join(", ")}` }],
          });
          return;
        }
        resolve({ ok: true, rows, errors });
      },
      error: (err) => resolve({ ok: false, rows: [], errors: [{ message: err.message }] }),
    });
  });
}

/* ============================================================
   Validate
   ============================================================ */

/**
 * Given parsed rows and refs { existingSkus: Set<string>,
 * currentStockBySku: Map<string, number> }, return per-row verdicts.
 *
 * currentStockBySku is used to display the DELTA in the preview
 * (going from 3 → 12 is more informative than just showing 12).
 */
export function validateRows(rows, refs) {
  const { existingSkus, currentStockBySku } = refs;
  const seenInCsv = new Map();

  const rowsWithVerdict = rows.map((row, idx) => {
    const errors = [];
    const resolved = {};

    // ---- sku ----
    const sku = (row.sku || "").trim();
    if (!sku) errors.push("SKU is required");
    else if (seenInCsv.has(sku)) {
      errors.push(`Duplicate SKU in this CSV (also on row ${seenInCsv.get(sku) + 2})`);
    } else {
      seenInCsv.set(sku, idx);
      if (!existingSkus.has(sku)) {
        errors.push(`SKU "${sku}" doesn't exist. Create the product first, or fix the SKU.`);
      }
    }
    resolved.sku = sku;

    // ---- stock ----
    const stockStr = (row.stock || "").replace(/[,\s]/g, "");
    const stock = Number(stockStr);
    if (stockStr === "") errors.push("Stock is required");
    else if (!Number.isInteger(stock) || stock < 0) {
      errors.push(`Stock "${row.stock}" is not a non-negative integer`);
    }
    resolved.stock = Math.max(0, Math.round(stock));

    // Compute delta for the preview so admin sees at a glance
    // what will change. currentStockBySku will only have SKUs
    // that exist; missing lookups fall back to null (— in UI).
    if (existingSkus.has(sku)) {
      const current = currentStockBySku.get(sku);
      resolved.currentStock = current;
      if (Number.isFinite(current)) {
        resolved.delta = resolved.stock - current;
      }
    }

    const verdict = errors.length > 0 ? "error" : "update";
    return { rowIndex: idx, row, verdict, errors, resolved };
  });

  const summary = {
    total:  rowsWithVerdict.length,
    update: rowsWithVerdict.filter((r) => r.verdict === "update").length,
    error:  rowsWithVerdict.filter((r) => r.verdict === "error").length,
    // Handy business-side view
    unchanged: rowsWithVerdict.filter((r) => r.verdict === "update" && r.resolved.delta === 0).length,
    up:        rowsWithVerdict.filter((r) => r.verdict === "update" && r.resolved.delta > 0).length,
    down:      rowsWithVerdict.filter((r) => r.verdict === "update" && r.resolved.delta < 0).length,
  };
  return { rowsWithVerdict, summary };
}

/* ============================================================
   Commit
   ============================================================ */

/**
 * Runs the actual updates. Only rows with verdict === 'update' are
 * committed. Sequential with a small delay to be nice to Supabase.
 *
 * Important: these are direct UPDATE ... SET stock = X calls, NOT
 * inserts into order_items. Which means the stock_decrement_trigger
 * we shipped in #2a does NOT fire. This is correct — bulk stock
 * update is "here's my new inventory count after receiving a
 * shipment," not "I sold something."
 */
export async function commitRows(rowsWithVerdict, onProgress) {
  const committable = rowsWithVerdict.filter((r) => r.verdict === "update");
  let updated = 0;
  const errors = [];

  for (let i = 0; i < committable.length; i++) {
    const item = committable[i];
    try {
      const { error } = await supabase
        .from("products")
        .update({ stock: item.resolved.stock })
        .eq("sku", item.resolved.sku);
      if (error) {
        errors.push({ rowIndex: item.rowIndex, sku: item.resolved.sku, message: error.message });
      } else {
        updated++;
      }
    } catch (err) {
      errors.push({ rowIndex: item.rowIndex, sku: item.resolved.sku, message: err.message || String(err) });
    }
    if (onProgress) onProgress(i + 1, committable.length);
    await new Promise((r) => setTimeout(r, 30));
  }

  return { updated, errors };
}