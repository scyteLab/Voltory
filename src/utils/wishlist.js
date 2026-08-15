/**
 * Wishlist persistence — stores SKUs in localStorage. Same shape
 * as the cart but simpler (no quantities, no totals; just a list of
 * SKUs the customer wants to keep an eye on).
 *
 * Replaced by a server-side wishlist API when the backend lands;
 * the shape stays.
 */
const KEY = "voltory_wishlist";

export function getStoredWishlist() {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveWishlist(skus) {
  try {
    localStorage.setItem(KEY, JSON.stringify(skus));
  } catch {
    /* noop */
  }
}

export function clearStoredWishlist() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}