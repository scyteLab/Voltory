import Papa from "papaparse";
import { supabase } from "./supabaseClient.js";

/**
 * priceBulkImport \u2014 CSV parsing + validation + commit for
 * PRICE-ONLY updates.
 *
 * Mirrors stockBulkImport pattern exactly. Same admin workflow:
 *   1. Download pre-filled template (all active SKUs + current prices)
 *   2. Edit new_price (and optionally new_was) in Excel
 *   3. Upload \u2014 only rows with changes are applied
 *
 * SAFETY GUARANTEE: commit sends ONLY { price, was } to Supabase.
 * Never touches stock, image, gallery, name, or any other column.
 *
 * Public API:
 *   generateTemplateCsv(rows)    \u2014 pre-filled template
 *   parseCsvFile(file)           \u2192 { ok, rows, errors }
 *   validateRows(rows, refs)     \u2192 { rowsWithVerdict, summary }
 *   commitRows(rowsWithVerdict)  \u2192 { updated, errors }
 *   TEMPLATE_CSV                 \u2014 fallback empty template
 *   COLUMNS                      \u2014 canonical column definitions
 *
 * Verdict values:
 *   'update'    \u2014 SKU exists, at least one price will change
 *   'unchanged' \u2014 SKU exists, no price changes (skip)
 *   'error'     \u2014 row is unusable
 */

/* ============================================================
   Column definitions
   ============================================================
   was is the "compare-at" price (crossed-out original). Optional
   \u2014 many products don't have a discount. Blank new_was means
   "no compare price" (or "keep as-is if unchanged").

   For the admin, current_price and current_was are read-only
   reference columns. Editable columns: new_price, new_was.
*/

export const COLUMNS = [
  { key: "sku",           required: true,  type: "text",  note: "Product code (do not edit \u2014 pre-filled)" },
  { key: "name",          required: false, type: "text",  note: "Product name (for reference only, ignored on upload)" },
  { key: "brand",         required: false, type: "text",  note: "Brand (for reference only, ignored on upload)" },
  { key: "current_price", required: false, type: "money", note: "Current selling price (for reference only, ignored on upload)" },
  { key: "current_was",   required: false, type: "money", note: "Current compare-at price (for reference only, ignored on upload)" },
  { key: "new_price",     required: true,  type: "money", note: "New selling price in naira \u2014 EDIT THIS COLUMN" },
  { key: "new_was",       required: false, type: "money", note: "New compare-at price in naira (blank = no discount) \u2014 EDIT THIS COLUMN" },
];

const REQUIRED_COLUMNS = COLUMNS.filter((c) => c.required).map((c) => c.key);

/* ============================================================
   Template generation \u2014 pre-filled with all active products
   ============================================================ */

export function generateTemplateCsv(rows) {
  const sorted = [...(rows || [])].sort((a, b) => {
    const brandCmp = (a.brand || "").localeCompare(b.brand || "");
    if (brandCmp !== 0) return brandCmp;
    return (a.name || "").localeCompare(b.name || "");
  });

  const csvRows = [
    ["sku", "name", "brand", "current_price", "current_was", "new_price", "new_was"],
    ...sorted.map((r) => [
      r.sku,
      r.name || "",
      r.brand || "",
      String(r.price ?? 0),
      r.was == null ? "" : String(r.was),
      String(r.price ?? 0),               /* pre-fill new_price = current_price */
      r.was == null ? "" : String(r.was), /* pre-fill new_was = current_was */
    ]),
  ];

  return Papa.unparse(csvRows);
}

/* ============================================================
   Fallback empty template
   ============================================================ */

export const TEMPLATE_CSV =
  ["sku","name","brand","current_price","current_was","new_price","new_was"].join(",") + "\n" +
  "SF-REF-350L,Scanfrost 350L Refrigerator,Scanfrost,285000,320000,285000,320000\n" +
  "MID-AC-15HP,Midea 1.5HP AC,Midea,395000,,395000,";

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
        const missing = REQUIRED_COLUMNS.filter((h) => !gotHeaders.includes(h));
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

export function validateRows(rows, refs) {
  const { existingSkus, currentPriceBySku, currentWasBySku } = refs;
  const seenInCsv = new Map();

  const rowsWithVerdict = rows.map((row, idx) => {
    const errors = [];
    const resolved = {};

    /* ---- sku ---- */
    const sku = (row.sku || "").trim();
    if (!sku) {
      errors.push("SKU is required");
    } else if (seenInCsv.has(sku)) {
      errors.push(`Duplicate SKU in this CSV (also on row ${seenInCsv.get(sku) + 2})`);
    } else {
      seenInCsv.set(sku, idx);
      if (!existingSkus.has(sku)) {
        errors.push(`SKU "${sku}" doesn't exist. Create the product first, or fix the SKU.`);
      }
    }
    resolved.sku = sku;

    /* ---- new_price ---- */
    const priceStr = (row.new_price || "").replace(/[,\s\u20A6]/g, "");   /* strip commas, spaces, \u20A6 */
    const price = Number(priceStr);
    if (priceStr === "") {
      errors.push("new_price is required");
    } else if (!Number.isFinite(price) || price <= 0) {
      errors.push(`new_price "${row.new_price}" is not a positive number`);
    }
    resolved.price = Math.round(price);

    /* ---- new_was ---- (optional) */
    const wasStr = (row.new_was || "").replace(/[,\s\u20A6]/g, "");
    let was = null;
    if (wasStr !== "") {
      was = Number(wasStr);
      if (!Number.isFinite(was) || was <= 0) {
        errors.push(`new_was "${row.new_was}" is not a positive number`);
      } else if (was <= price) {
        errors.push(`new_was (${was}) must be higher than new_price (${price}) \u2014 that's how the crossed-out discount works`);
      }
    }
    resolved.was = was == null ? null : Math.round(was);

    /* Track current values for delta display */
    if (existingSkus.has(sku)) {
      resolved.currentPrice = currentPriceBySku.get(sku) ?? 0;
      resolved.currentWas   = currentWasBySku.get(sku) ?? null;
    }

    /* Verdict logic:
       - errors \u2192 error
       - price unchanged AND was unchanged \u2192 unchanged
       - otherwise \u2192 update
    */
    let verdict;
    if (errors.length > 0) {
      verdict = "error";
    } else {
      const priceSame = resolved.price === resolved.currentPrice;
      const wasSame   = (resolved.was ?? null) === (resolved.currentWas ?? null);
      verdict = (priceSame && wasSame) ? "unchanged" : "update";
    }

    return { rowIndex: idx, row, verdict, errors, resolved };
  });

  const summary = {
    total:     rowsWithVerdict.length,
    update:    rowsWithVerdict.filter((r) => r.verdict === "update").length,
    unchanged: rowsWithVerdict.filter((r) => r.verdict === "unchanged").length,
    error:     rowsWithVerdict.filter((r) => r.verdict === "error").length,
    priceUp:   rowsWithVerdict.filter((r) => r.verdict === "update" && r.resolved.price > (r.resolved.currentPrice || 0)).length,
    priceDown: rowsWithVerdict.filter((r) => r.verdict === "update" && r.resolved.price < (r.resolved.currentPrice || 0)).length,
  };
  return { rowsWithVerdict, summary };
}

/* ============================================================
   Commit \u2014 partial UPDATE, ONLY price + was columns
   ============================================================ */

export async function commitRows(rowsWithVerdict, onProgress) {
  const committable = rowsWithVerdict.filter((r) => r.verdict === "update");
  let updated = 0;
  const errors = [];

  for (let i = 0; i < committable.length; i++) {
    const item = committable[i];
    try {
      const { error } = await supabase
        .from("products")
        .update({
          price: item.resolved.price,
          was:   item.resolved.was,
        })    /* ONLY price and was */
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