/**
 * Warranty display rule (storefront).
 *
 * Warranty terms are set by each manufacturer, so customers never see
 * a specific period (years/months) from us. The data is kept as-is
 * (products.warranty_months, imported spec rows, highlights); it is
 * only filtered out at display time.
 */

export const WARRANTY_LABEL = "Covered by manufacturer's warranty";

const WARRANTY_RE = /warrant/i;

export function mentionsWarranty(text) {
  return WARRANTY_RE.test(String(text || ""));
}

/** Drop spec rows whose label is about warranty ("Warranty",
 *  "Compressor Warranty", ...). Accepts {label,value} or [label,value]. */
export function withoutWarrantySpecs(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => {
    const label = Array.isArray(r) ? r[0] : r?.label;
    return !mentionsWarranty(label);
  });
}

/** Drop highlight lines that talk about warranty ("10-Year Compressor
 *  Warranty", "Warranty: 2 Years"). */
export function withoutWarrantyHighlights(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((h) => !mentionsWarranty(h));
}
