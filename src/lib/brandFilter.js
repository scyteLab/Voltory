/**
 * Brand filter helpers for listing pages.
 *
 * The brand filter lives in the URL as lowercase brand ids (slugs):
 *   /category/air-conditioners?brand=scanfrost,midea
 *
 * products.brand stores the brand NAME, and its casing hasn't always
 * been consistent ("scanfrost" vs "Scanfrost"), so every comparison
 * here goes through a case-insensitive resolver. Older links that
 * used the name (?brand=Scanfrost) still work.
 */

/** Fallback slug for a brand that has no row in the brands table. */
export function brandSlug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build a resolver over the catalog's brands.
 *   slugOf(nameOrId) → canonical lowercase id
 *   recordOf(slug)   → brand row ({ id, name, logo }) or null
 */
export function makeBrandResolver(brands) {
  const byKey = new Map();
  for (const b of brands || []) {
    if (b.id) byKey.set(String(b.id).toLowerCase(), b);
    if (b.name) byKey.set(String(b.name).toLowerCase(), b);
  }
  const recordOf = (v) => byKey.get(String(v || "").trim().toLowerCase()) || null;
  const slugOf = (v) => {
    const rec = recordOf(v);
    return rec?.id ? String(rec.id).toLowerCase() : brandSlug(v);
  };
  return { slugOf, recordOf };
}

/**
 * Brands present in a product list, with counts, most products first.
 * Returns [{ slug, name, brand, count }], where `brand` is the catalog
 * row when there is one (for the logo) or a minimal stand-in.
 */
export function brandOptionsFor(products, resolver) {
  const map = new Map();
  for (const p of products) {
    if (!p.brand) continue;
    const slug = resolver.slugOf(p.brand);
    let o = map.get(slug);
    if (!o) {
      const rec = resolver.recordOf(p.brand);
      o = {
        slug,
        name: rec?.name || p.brand,
        brand: rec || { id: slug, name: p.brand, logo: null },
        count: 0,
      };
      map.set(slug, o);
    }
    o.count++;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Normalise raw URL values to unique canonical slugs. */
export function normaliseBrandParam(values, resolver) {
  return [...new Set((values || []).map((v) => resolver.slugOf(v)).filter(Boolean))];
}
