/**
 * productsBulkImport.js
 *
 * CSV bulk import for products. Parses, validates, and commits
 * product rows via Supabase upsert.
 *
 * Extended (2026-08-21) to support:
 *   \u00B7 image             \u2014 main product image URL
 *   \u00B7 gallery           \u2014 additional images (comma-separated URLs)
 *   \u00B7 warranty_months   \u2014 integer (0+), shows warranty badge
 *   \u00B7 energy_class      \u2014 text (A++, A+, A, B, C, D)
 *   \u00B7 hp                \u2014 decimal, AC horsepower
 *   \u00B7 litres            \u2014 integer, fridge/freezer capacity
 *   \u00B7 doors             \u2014 integer, fridge doors
 *   \u00B7 inverter          \u2014 boolean ('true'/'false' in CSV)
 *
 * Shape fix (2026-08-22): output row shape restored to match what
 * ImportPreviewTable.jsx expects:
 *   {
 *     rowIndex,       // top-level (not _rowIndex)
 *     verdict,        // top-level (not _verdict)
 *     errors: [...],  // top-level (not _errors)
 *     resolved: {},   // validated/typed values (not _values)
 *     row: {},        // original CSV row fields
 *   }
 *
 * All new columns are OPTIONAL. Existing 10-column CSVs still work.
 *
 * Behavior:
 *   \u00B7 UPSERT by SKU \u2014 existing SKUs update, new SKUs insert
 *   \u00B7 Brand must exist in DB (case-sensitive)
 *   \u00B7 Category must be a valid category ID (the slug, not the label)
 *   \u00B7 Rows with errors are skipped, valid rows still import
 *
 * Public API:
 *   parseCsvFile(file)      \u2192 { ok, rows?, errors? }
 *   validateRows(rows, refs) \u2192 { rowsWithVerdict, summary }
 *   commitRows(rows, onProgress) \u2192 { created, updated, errors }
 *   TEMPLATE_CSV            \u2014 downloadable template string
 *   COLUMNS                 \u2014 column metadata for the help table
 */

import { supabase } from "./supabaseClient.js";

/* ============================================================
   COLUMN DEFINITIONS
   ============================================================ */

export const COLUMNS = [
  { key: "sku",             required: true,  note: "Unique product code, e.g. SF-AC-12K-INV" },
  { key: "name",            required: true,  note: "Full product title" },
  { key: "brand",           required: true,  note: "Exact brand name from DB, e.g. Scanfrost, Midea, Samsung" },
  { key: "category",        required: true,  note: "Category ID (slug), e.g. air-conditioners, refrigerators-freezers" },
  { key: "model",           required: false, note: "Manufacturer model number" },
  { key: "price",           required: true,  note: "Selling price (whole number, no commas or currency, VAT-inclusive)" },
  { key: "was",             required: false, note: "Compare-at price (must be higher than selling price)" },
  { key: "stock",           required: true,  note: "Current stock (integer, 0 or higher)" },
  { key: "status",          required: false, note: "'active' (default) or 'inactive'" },
  { key: "description",     required: false, note: "Short paragraph shown on product page (~280 chars)" },
  { key: "image",           required: false, note: "Main image URL (Supabase Storage or other public URL)" },
  { key: "gallery",         required: false, note: "Extra images: comma-separated URLs, e.g. url1,url2,url3" },
  { key: "warranty_months", required: false, note: "Warranty length in months, e.g. 24 for 2 years" },
  { key: "energy_class",    required: false, note: "Energy rating: A++, A+, A, B, C, D" },
  { key: "hp",              required: false, note: "Horsepower for ACs, e.g. 1.5" },
  { key: "litres",          required: false, note: "Capacity in litres for fridges" },
  { key: "doors",           required: false, note: "Number of doors for fridges" },
  { key: "inverter",        required: false, note: "'true' or 'false' for inverter-capable products" },
];

const ACCEPTED_COLUMNS = COLUMNS.map((c) => c.key);
const REQUIRED_COLUMNS = COLUMNS.filter((c) => c.required).map((c) => c.key);

/* ============================================================
   TEMPLATE CSV
   ============================================================ */

export const TEMPLATE_CSV = [
  ACCEPTED_COLUMNS.join(","),
  /* Sample rows \u2014 one per brand across relevant categories */
  `SF-AC-12K-INV,Scanfrost 1.5HP Inverter Split AC,Scanfrost,air-conditioners,SFACS12K-INV,285000,320000,15,active,"Energy-efficient inverter split AC with fast cooling.",,,24,A+,1.5,,,true`,
  `MD-AC-18K-INV,Midea 2.0HP Inverter Split AC,Midea,air-conditioners,MSAFB-18HRDN8,395000,,12,active,"Powerful 2HP inverter split AC with R32 refrigerant.",,,60,A++,2,,,true`,
  `SM-TV-55Q,Samsung 55-inch QLED 4K Smart TV,Samsung,televisions-audio,QA55Q60C,725000,850000,6,active,"Quantum Dot QLED display with HDR10+ and smart hub.",,,24,,,,,`,
  `SM-RF-560L,Samsung 560L Side-by-Side Refrigerator,Samsung,refrigerators-freezers,RS62R5001M9,895000,,4,active,"560L side-by-side fridge with digital inverter compressor.",,,120,A+,,560,2,true`,
  `PA-TV-43LED,Panasonic 43-inch Full HD LED TV,Panasonic,televisions-audio,TH-43H400,215000,240000,10,active,"Full HD LED TV with vivid color engine.",,,24,,,,,`,
  `SN-TV-50BR,Sony 50-inch 4K Google TV,Sony,televisions-audio,KD-50X75L,545000,,7,active,"4K HDR X1 processor with Google TV.",,,24,,,,,`,
  `KW-BL-750,Kenwood 750W Blender,Kenwood,small-appliances,BL450,32000,,30,active,"750W multi-speed blender with 1.5L glass jar.",,,12,,,,,`,
].join("\n");

/* ============================================================
   CSV PARSE
   ============================================================ */

/**
 * Parse a CSV file. Handles quoted values (needed for descriptions
 * with commas). Returns rows as objects keyed by column name.
 */
export async function parseCsvFile(file) {
  if (!file) return { ok: false, errors: [{ message: "No file provided." }] };

  try {
    const text = await file.text();
    const rows = parseCsvText(text);

    if (rows.length === 0) {
      return { ok: false, errors: [{ message: "CSV appears to be empty." }] };
    }

    /* First row = headers */
    const headers = rows[0].map((h) => (h || "").trim().toLowerCase());
    const dataRows = rows.slice(1);

    /* Validate header presence */
    const missingRequired = REQUIRED_COLUMNS.filter((c) => !headers.includes(c));
    if (missingRequired.length > 0) {
      return {
        ok: false,
        errors: [{ message: `Missing required columns: ${missingRequired.join(", ")}` }],
      };
    }

    /* Unknown columns are IGNORED silently, not errored, so admin can
       have extra tracking columns in their working sheet. */

    /* Convert to plain objects (no leading underscore markers here \u2014
       that goes on the wrapper produced by validateRows). */
    const objects = dataRows
      .filter((r) => r.some((v) => (v || "").trim() !== ""))    // skip fully blank lines
      .map((row) => {
        const obj = {};
        headers.forEach((h, idx) => {
          if (ACCEPTED_COLUMNS.includes(h)) {
            obj[h] = (row[idx] || "").trim();
          }
        });
        return obj;
      });

    return { ok: true, rows: objects };
  } catch (err) {
    return { ok: false, errors: [{ message: err.message || String(err) }] };
  }
}

/**
 * Simple CSV parser. Handles quoted values and escaped quotes.
 * Not RFC 4180 perfect but good enough for admin-created spreadsheets
 * exported from Excel or Google Sheets.
 */
function parseCsvText(text) {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      currentField += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ",") {
      currentRow.push(currentField);
      currentField = "";
      i++;
      continue;
    }

    if (ch === "\r") { i++; continue; }

    if (ch === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      i++;
      continue;
    }

    currentField += ch;
    i++;
  }

  /* Final row (no trailing newline) */
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

/* ============================================================
   VALIDATION
   ============================================================
   Output shape (this is what ImportPreviewTable expects):

     rowsWithVerdict: [
       {
         rowIndex,   // integer, position in CSV (0-based)
         verdict,    // 'create' | 'update' | 'error'
         errors,     // array of human-readable error strings
         row: {},    // original CSV values (raw strings)
         resolved: { // validated + typed values ready for DB
           sku, name, brand, category, model, description, price,
           was, stock, status, image, gallery, warranty_months,
           energy_class, hp, litres, doors, inverter, slug
         }
       },
       ...
     ]

     summary: { total, create, update, error }
*/
export function validateRows(rows, refs) {
  const rowsWithVerdict = rows.map((row, rowIndex) => {
    const errors = [];
    const resolved = {
      /* copy the required text fields as-is by default */
      sku:      row.sku      || null,
      name:     row.name     || null,
      brand:    row.brand    || null,
      category: row.category || null,
      model:    row.model    || null,
    };

    /* Required text fields */
    if (!row.sku)        errors.push("SKU is required");
    if (!row.name)       errors.push("Name is required");
    if (!row.brand)      errors.push("Brand is required");
    if (!row.category)   errors.push("Category is required");

    /* SKU format \u2014 letters, digits, hyphens, underscores only */
    if (row.sku && !/^[A-Za-z0-9_-]+$/.test(row.sku)) {
      errors.push("SKU can only contain letters, digits, hyphens, underscores");
    }

    /* Brand FK check (case-sensitive) */
    if (row.brand && !refs.brandNames.has(row.brand)) {
      errors.push(`Brand "${row.brand}" doesn't exist in DB. Case-sensitive; check exact spelling.`);
    }

    /* Category FK check \u2014 CSV uses the category ID (slug) */
    if (row.category && !refs.categoryById.has(row.category)) {
      errors.push(`Category "${row.category}" doesn't exist. Use the category ID (e.g. air-conditioners), not the label.`);
    }

    /* Numeric fields */
    const price = num(row.price);
    if (row.price === "" || price == null || price <= 0) {
      errors.push("Price must be a positive number (no commas or currency symbols)");
    } else {
      resolved.price = price;
    }

    if (row.was) {
      const was = num(row.was);
      if (was == null) errors.push("Compare-at price must be a number");
      else if (price != null && was <= price) errors.push("Compare-at price must be higher than selling price");
      else resolved.was = was;
    } else {
      resolved.was = null;
    }

    const stock = num(row.stock);
    if (row.stock === "" || stock == null || stock < 0 || !Number.isInteger(stock)) {
      errors.push("Stock must be a whole number, 0 or higher");
    } else {
      resolved.stock = stock;
    }

    /* Status */
    resolved.status = row.status || "active";
    if (resolved.status !== "active" && resolved.status !== "inactive") {
      errors.push("Status must be 'active' or 'inactive'");
    }

    /* Description */
    resolved.description = row.description || null;

    /* --- EXTENDED COLUMNS --- */

    /* Image \u2014 URL or blank */
    resolved.image = row.image || null;
    if (resolved.image && !isValidUrlOrPath(resolved.image)) {
      errors.push(`Image URL doesn't look valid: ${resolved.image}`);
    }

    /* Gallery \u2014 comma-separated URLs \u2192 array */
    if (row.gallery) {
      const urls = row.gallery.split(",").map((u) => u.trim()).filter(Boolean);
      const invalid = urls.filter((u) => !isValidUrlOrPath(u));
      if (invalid.length > 0) {
        errors.push(`Gallery contains invalid URL(s): ${invalid.slice(0, 2).join(", ")}${invalid.length > 2 ? "..." : ""}`);
      }
      resolved.gallery = urls;
    } else {
      resolved.gallery = [];
    }

    /* Warranty months */
    if (row.warranty_months) {
      const w = num(row.warranty_months);
      if (w == null || w < 0 || !Number.isInteger(w)) {
        errors.push("Warranty months must be a whole number (0 or higher)");
      } else {
        resolved.warranty_months = w;
      }
    } else {
      resolved.warranty_months = null;
    }

    /* Energy class */
    resolved.energy_class = row.energy_class || null;
    if (resolved.energy_class && !/^[A-D]\+{0,2}$/.test(resolved.energy_class)) {
      errors.push(`Energy class must be one of: A++, A+, A, B, C, D (got: ${resolved.energy_class})`);
    }

    /* HP (horsepower for ACs) */
    if (row.hp) {
      const hp = num(row.hp);
      if (hp == null || hp <= 0) {
        errors.push("HP must be a positive number, e.g. 1.5");
      } else {
        resolved.hp = hp;
      }
    } else {
      resolved.hp = null;
    }

    /* Litres */
    if (row.litres) {
      const l = num(row.litres);
      if (l == null || l <= 0 || !Number.isInteger(l)) {
        errors.push("Litres must be a positive whole number");
      } else {
        resolved.litres = l;
      }
    } else {
      resolved.litres = null;
    }

    /* Doors */
    if (row.doors) {
      const d = num(row.doors);
      if (d == null || d <= 0 || !Number.isInteger(d)) {
        errors.push("Doors must be a positive whole number");
      } else {
        resolved.doors = d;
      }
    } else {
      resolved.doors = null;
    }

    /* Inverter (boolean) */
    if (row.inverter) {
      const val = row.inverter.toLowerCase();
      if (val === "true" || val === "yes" || val === "1") {
        resolved.inverter = true;
      } else if (val === "false" || val === "no" || val === "0") {
        resolved.inverter = false;
      } else {
        errors.push("Inverter must be 'true' or 'false' (got: " + row.inverter + ")");
      }
    } else {
      resolved.inverter = null;
    }

    /* Slug is derived, not from CSV */
    resolved.slug = autoSlug(resolved.name, resolved.sku);

    /* Determine verdict \u2014 defaults to 'error' if any errors, else
       'update' if the SKU already exists, else 'create' */
    let verdict = "error";
    if (errors.length === 0) {
      verdict = refs.existingSkus.has(row.sku) ? "update" : "create";
    }

    /* Return the shape ImportPreviewTable expects \u2014
       rowIndex/verdict/errors/resolved/row at TOP LEVEL (not underscored) */
    return {
      rowIndex,
      verdict,
      errors,
      row,        // original CSV values (raw strings) \u2014 preview table reads r.row.brand, r.row.category
      resolved,   // validated + typed values \u2014 preview table reads r.resolved.sku etc
    };
  });

  const summary = {
    total:  rowsWithVerdict.length,
    create: rowsWithVerdict.filter((r) => r.verdict === "create").length,
    update: rowsWithVerdict.filter((r) => r.verdict === "update").length,
    error:  rowsWithVerdict.filter((r) => r.verdict === "error").length,
  };

  return { rowsWithVerdict, summary };
}

/* ============================================================
   COMMIT
   ============================================================ */

/**
 * Commit valid rows to Supabase via upsert.
 * Only rows with verdict 'create' or 'update' are committed.
 * Rows with verdict 'error' are skipped.
 *
 * onProgress(done, total) is called after each row.
 */
export async function commitRows(rowsWithVerdict, onProgress) {
  const validRows = rowsWithVerdict.filter(
    (r) => r.verdict === "create" || r.verdict === "update"
  );

  const result = {
    created: 0,
    updated: 0,
    errors: [],
  };

  const total = validRows.length;
  let done = 0;

  for (const row of validRows) {
    const wasUpdate = row.verdict === "update";
    const r = row.resolved;

    /* Build DB payload from resolved values */
    const payload = {
      sku:              r.sku,
      slug:             r.slug,
      name:             r.name,
      brand:            r.brand,
      category:         r.category,
      model:            r.model || null,
      description:      r.description,
      price:            r.price,
      was:              r.was,
      stock:            r.stock,
      status:           r.status,
      /* Extended fields */
      image:            r.image,
      gallery:          r.gallery,
      warranty_months:  r.warranty_months,
      energy_class:     r.energy_class,
      hp:               r.hp,
      litres:           r.litres,
      doors:            r.doors,
      inverter:         r.inverter,
    };

    const { error } = await supabase
      .from("products")
      .upsert(payload, { onConflict: "sku" });

    if (error) {
      result.errors.push({
        rowIndex: row.rowIndex,
        sku: r.sku,
        message: error.message,
      });
    } else if (wasUpdate) {
      result.updated += 1;
    } else {
      result.created += 1;
    }

    done += 1;
    if (onProgress) onProgress(done, total);
  }

  return result;
}

/* ============================================================
   HELPERS
   ============================================================ */

function num(v) {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isValidUrlOrPath(s) {
  if (!s) return false;
  /* Accept full URLs (http/https) OR relative paths starting with / */
  return /^https?:\/\//i.test(s) || s.startsWith("/");
}

function autoSlug(name, fallback) {
  const slug = (name || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return slug || (fallback || "").toLowerCase();
}