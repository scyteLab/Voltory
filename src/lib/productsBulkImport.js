import Papa from "papaparse";
import { supabase } from "./supabaseClient.js";

/**
 * productsBulkImport  \u2014 CSV parsing + validation + commit
 *
 * Public API:
 *   parseCsvFile(file)         \u2192 { ok, rows, errors }
 *   validateRows(rows, refs)   \u2192 { rowsWithVerdict, summary }
 *   commitRows(rowsWithVerdict) \u2192 { created, updated, errors }
 *   TEMPLATE_CSV               \u2014 the download template string
 *   COLUMNS                    \u2014 canonical column definitions
 *
 * Design:
 *   \u00B7 Every row is either 'create', 'update', or 'error' with a reason
 *   \u00B7 Reference data (existing SKUs, brand names, category id\u2194name map)
 *     is passed in explicitly so validation is deterministic and testable
 *   \u00B7 Commit uses upsert with onConflict: 'sku' \u2014 same path the single-
 *     product editor uses. If a row was flagged 'update', we let Postgres
 *     confirm by returning `xmax != 0` from the upsert (we skip that
 *     complexity; we already know from validation)
 *   \u00B7 Commit runs sequentially with a small delay so we don't hammer
 *     Supabase's rate limits. 100-product imports take ~5s, tolerable.
 */

/* ============================================================
   Column definitions
   ============================================================ */

export const COLUMNS = [
  { key: "sku",         required: true,  type: "text",   note: "Unique product code, e.g. SF-REF-350L" },
  { key: "name",        required: true,  type: "text",   note: "Product display name" },
  { key: "brand",       required: true,  type: "text",   note: "Must match an existing brand name exactly" },
  { key: "category",    required: true,  type: "text",   note: "Category id OR name (name is looked up)" },
  { key: "model",       required: false, type: "text",   note: "Manufacturer model number, e.g. SFR-350LX" },
  { key: "price",       required: true,  type: "int",    note: "Selling price in whole naira, e.g. 285000" },
  { key: "was",         required: false, type: "int",    note: "Original / crossed-out price for discount display" },
  { key: "stock",       required: true,  type: "int",    note: "Units available, e.g. 12" },
  { key: "status",      required: false, type: "text",   note: "active | inactive (defaults to active)" },
  { key: "description", required: false, type: "text",   note: "Long description shown on product page" },
];

const HEADER_ORDER = COLUMNS.map((c) => c.key);

/* ============================================================
   Template
   ============================================================ */

export const TEMPLATE_CSV =
  HEADER_ORDER.join(",") + "\n" +
  [
    "SF-REF-EXAMPLE",                   // sku
    "Scanfrost 350L Refrigerator",      // name
    "Scanfrost",                        // brand (must exist in brands table)
    "refrigerators-freezers",           // category (id or name)
    "SFR-350LX",                        // model
    "285000",                           // price
    "320000",                           // was
    "8",                                // stock
    "active",                           // status
    "Energy-efficient double-door refrigerator with inverter compressor.", // description
  ].map(csvCell).join(",");

/* ============================================================
   Parse
   ============================================================ */

/**
 * Read a File object as CSV. Returns Papa's parsed rows as objects
 * keyed by header. Trims whitespace from all fields.
 *
 * Returns { ok, rows, errors }.
 */
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
        // Header sanity check
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
 * Given parsed rows and a `refs` object with:
 *   { existingSkus:Set<string>, brandNames:Set<string>,
 *     categoryById:Map<string,string>, categoryByName:Map<string,string> }
 *
 * Returns { rowsWithVerdict, summary } where each row has:
 *   { row, verdict, errors, resolved }
 *
 *   verdict: 'create' | 'update' | 'error'
 *   errors: [string]    (populated when verdict = 'error')
 *   resolved: {         (populated when verdict != 'error')
 *     sku, name, brand, category, model, price, was, stock, status, description
 *   }
 */
export function validateRows(rows, refs) {
  const { existingSkus, brandNames, categoryById, categoryByName } = refs;

  // Duplicate-SKU-within-CSV detection
  const seenInCsv = new Map(); // sku -> row index
  const rowsWithVerdict = rows.map((row, idx) => {
    const errors = [];
    const resolved = {};

    // ---- sku ----
    const sku = (row.sku || "").trim();
    if (!sku) errors.push("SKU is required");
    else if (seenInCsv.has(sku)) errors.push(`Duplicate SKU in this CSV (also on row ${seenInCsv.get(sku) + 2})`);
    else seenInCsv.set(sku, idx);
    resolved.sku = sku;

    // ---- name ----
    const name = (row.name || "").trim();
    if (!name) errors.push("Name is required");
    resolved.name = name;

    // ---- brand ----
    const brand = (row.brand || "").trim();
    if (!brand) errors.push("Brand is required");
    else if (!brandNames.has(brand)) {
      errors.push(`Brand "${brand}" doesn't exist. Create it in Catalog \u2192 Brands first.`);
    }
    resolved.brand = brand;

    // ---- category (id or name) ----
    const categoryRaw = (row.category || "").trim();
    let categoryId = null;
    if (!categoryRaw) {
      errors.push("Category is required");
    } else if (categoryById.has(categoryRaw)) {
      categoryId = categoryRaw;
    } else if (categoryByName.has(categoryRaw.toLowerCase())) {
      categoryId = categoryByName.get(categoryRaw.toLowerCase());
    } else {
      errors.push(`Category "${categoryRaw}" doesn't exist. Create it in Catalog \u2192 Categories first, or use its id.`);
    }
    resolved.category = categoryId;

    // ---- model (optional) ----
    resolved.model = (row.model || "").trim() || null;

    // ---- price ----
    const priceStr = (row.price || "").replace(/[,\s]/g, "");
    const price = Number(priceStr);
    if (!priceStr) errors.push("Price is required");
    else if (!Number.isFinite(price) || price <= 0) errors.push(`Price "${row.price}" is not a positive number`);
    resolved.price = Math.round(price);

    // ---- was (optional) ----
    if (row.was) {
      const wasStr = row.was.replace(/[,\s]/g, "");
      const was = Number(wasStr);
      if (!Number.isFinite(was) || was <= 0) errors.push(`"was" price "${row.was}" is not a positive number`);
      else if (Number.isFinite(price) && was <= price) errors.push(`"was" (${was}) should be higher than price (${price})`);
      else resolved.was = Math.round(was);
    } else {
      resolved.was = null;
    }

    // ---- stock ----
    const stockStr = (row.stock || "").replace(/[,\s]/g, "");
    const stock = Number(stockStr);
    if (stockStr === "") errors.push("Stock is required");
    else if (!Number.isInteger(stock) || stock < 0) errors.push(`Stock "${row.stock}" is not a non-negative integer`);
    resolved.stock = Math.max(0, Math.round(stock));

    // ---- status ----
    const status = ((row.status || "active").trim().toLowerCase());
    if (!["active", "inactive"].includes(status)) {
      errors.push(`Status "${row.status}" must be "active" or "inactive"`);
    }
    resolved.status = status;

    // ---- description ----
    resolved.description = (row.description || "").trim() || null;

    // ---- slug (auto-generated from name; SKU tail for uniqueness safety) ----
    // If two different SKUs somehow produce the same base slug (e.g.
    // "Scanfrost 350L" x2), the SKU tail keeps them distinct. On update
    // paths, the slug regenerates the same way so it stays stable.
    resolved.slug = slugify(name || sku);
    // Guard against slug collision: if there are duplicate names in
    // this CSV, append SKU-derived suffix. We only append when the
    // base slug would collide within this CSV, checked below.

    // Verdict
    let verdict;
    if (errors.length > 0) verdict = "error";
    else if (existingSkus.has(sku)) verdict = "update";
    else verdict = "create";

    return { rowIndex: idx, row, verdict, errors, resolved };
  });

  const summary = {
    total:   rowsWithVerdict.length,
    create:  rowsWithVerdict.filter((r) => r.verdict === "create").length,
    update:  rowsWithVerdict.filter((r) => r.verdict === "update").length,
    error:   rowsWithVerdict.filter((r) => r.verdict === "error").length,
  };

  // Post-process: if two non-error rows share the same slug, disambiguate
  // by appending a SKU-derived tail. Keeps human-friendly URLs where
  // possible and only ugly-fies when necessary.
  const slugCounts = new Map();
  rowsWithVerdict.forEach((r) => {
    if (r.verdict === "error") return;
    slugCounts.set(r.resolved.slug, (slugCounts.get(r.resolved.slug) || 0) + 1);
  });
  rowsWithVerdict.forEach((r) => {
    if (r.verdict === "error") return;
    if (slugCounts.get(r.resolved.slug) > 1) {
      const tail = slugify(r.resolved.sku).slice(-8);
      r.resolved.slug = `${r.resolved.slug}-${tail}`;
    }
  });

  return { rowsWithVerdict, summary };
}

/* ============================================================
   Commit
   ============================================================ */

/**
 * Runs the actual upserts. Only rows with verdict != 'error' are
 * committed. Returns per-row results so the UI can render a summary.
 *
 * `onProgress(done, total)` is called after every row so the UI
 * can render a progress bar.
 */
export async function commitRows(rowsWithVerdict, onProgress) {
  const committable = rowsWithVerdict.filter((r) => r.verdict !== "error");
  let created = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < committable.length; i++) {
    const item = committable[i];
    const payload = {
      sku:         item.resolved.sku,
      slug:        item.resolved.slug,
      name:        item.resolved.name,
      brand:       item.resolved.brand,
      category:    item.resolved.category,
      model:       item.resolved.model,
      price:       item.resolved.price,
      was:         item.resolved.was,
      stock:       item.resolved.stock,
      status:      item.resolved.status,
      description: item.resolved.description,
    };

    try {
      const { error } = await supabase
        .from("products")
        .upsert(payload, { onConflict: "sku" });
      if (error) {
        errors.push({ rowIndex: item.rowIndex, sku: item.resolved.sku, message: error.message });
      } else {
        if (item.verdict === "create") created++;
        else if (item.verdict === "update") updated++;
      }
    } catch (err) {
      errors.push({ rowIndex: item.rowIndex, sku: item.resolved.sku, message: err.message || String(err) });
    }

    if (onProgress) onProgress(i + 1, committable.length);

    // Small delay to avoid hammering \u2014 100 products = 5s. Adjust if
    // you're doing much bigger imports.
    await new Promise((r) => setTimeout(r, 40));
  }

  return { created, updated, errors };
}

/* ============================================================
   Helpers
   ============================================================ */

function slugify(str) {
  return (str || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Wrap a CSV cell in quotes if it contains a comma, quote, or newline.
 * Used only by the template generator.
 */
function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}