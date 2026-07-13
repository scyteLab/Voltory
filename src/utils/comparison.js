/**
 * Comparison list \u2014 stores up to 4 SKUs in localStorage so the
 * customer can pull together a side-by-side comparison from
 * anywhere on the site. Same shape as the wishlist (a list of
 * SKUs) but capped, because a comparison table beyond 4 columns
 * stops being readable on every screen size.
 *
 * Replaced by a server-side endpoint when the backend lands;
 * the shape stays.
 */
const KEY = "voltory_comparison";
export const MAX_COMPARE = 4;

export function getStoredComparison() {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items.slice(0, MAX_COMPARE) : [];
  } catch {
    return [];
  }
}

export function saveComparison(skus) {
  try {
    localStorage.setItem(KEY, JSON.stringify(skus.slice(0, MAX_COMPARE)));
  } catch {
    /* noop */
  }
}

export function clearStoredComparison() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}