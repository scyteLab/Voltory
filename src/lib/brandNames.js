/* Pure helper (no browser APIs): used by catalogClient and scripts/seo-build.mjs. */

/**
 * Brand names on products were saved with mixed casing ("Scanfrost" and
 * "scanfrost"), which split one brand into two in filters, counts and
 * brand pages. Map every spelling onto the name in the brands table
 * (matched case-insensitively against the brand's name or id); anything
 * not in the table keeps its most common spelling.
 */
export function canonicalBrandResolver(brands, products = []) {
  const byKey = new Map();
  for (const b of brands || []) {
    if (b?.name) byKey.set(String(b.name).trim().toLowerCase(), b.name);
    if (b?.id && b?.name) byKey.set(String(b.id).trim().toLowerCase(), b.name);
  }
  // Brands missing from the table: use the most frequent spelling.
  const tally = new Map();
  for (const p of products) {
    const raw = String(p?.brand || "").trim();
    const key = raw.toLowerCase();
    if (!raw || byKey.has(key)) continue;
    const counts = tally.get(key) || new Map();
    counts.set(raw, (counts.get(raw) || 0) + 1);
    tally.set(key, counts);
  }
  for (const [key, counts] of tally) {
    const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    byKey.set(key, best);
  }
  return (name) => {
    const raw = String(name || "").trim();
    return byKey.get(raw.toLowerCase()) || raw;
  };
}
