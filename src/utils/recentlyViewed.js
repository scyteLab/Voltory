/**
 * Recently viewed products — persisted in localStorage so the
 * "Last Viewed" home section survives reloads without a backend.
 */
const KEY = "voltory_recently_viewed";
const MAX = 8;

export function getRecentlyViewed() {
  try {
    const raw = localStorage.getItem(KEY);
    const skus = raw ? JSON.parse(raw) : [];
    return Array.isArray(skus) ? skus : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(sku) {
  try {
    const next = [sku, ...getRecentlyViewed().filter((s) => s !== sku)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (privacy mode etc.) — silently skip
  }
}
