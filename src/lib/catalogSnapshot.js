import {
  PRODUCTS as FALLBACK_PRODUCTS,
  CATEGORIES as FALLBACK_CATEGORIES,
  BRANDS as FALLBACK_BRANDS,
} from "../data/products.js";

/**
 * catalogSnapshot
 *
 * Holds the current catalog in module scope so non-React code
 * (utilities, context reducers, event handlers) can read it
 * without a hook.
 *
 * Kept in sync by CatalogContext, which calls setSnapshot() every
 * time its state changes. Before the first successful load, the
 * hardcoded arrays serve as the snapshot — so searchEngine and
 * pricing math still work on cold render.
 *
 * This is a small, deliberate escape hatch. Components should
 * still prefer useCatalog(). Reach for the snapshot only in code
 * that fundamentally can't be a hook (order line-item creation
 * inside a callback, search results computed inside a memo).
 */

let current = {
  products:   FALLBACK_PRODUCTS,
  categories: FALLBACK_CATEGORIES,
  brands:     FALLBACK_BRANDS,
};

export function setSnapshot({ products, categories, brands }) {
  current = { products, categories, brands };
}

export function getSnapshot() {
  return current;
}

/** Convenience readers matching the old data/products.js exports. */
export function snapshotBySku(sku) {
  return current.products.find((p) => p.sku === sku) || null;
}
export function snapshotBySlug(slug) {
  return current.products.find((p) => p.slug === slug) || null;
}
export function snapshotByCategory(catId) {
  return current.products.filter((p) => p.category === catId);
}
export function snapshotByBrand(brand) {
  return current.products.filter((p) => p.brand === brand);
}
export function snapshotCategoryById(catId) {
  return current.categories.find((c) => c.id === catId) || null;
}