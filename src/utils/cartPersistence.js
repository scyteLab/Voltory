/**
 * Cart persistence — keeps the cart alive across page refreshes
 * and browser sessions. Same localStorage pattern as recentlyViewed.js.
 * Replaced by server-side cart sessions when the backend lands.
 */
const KEY = "voltory_cart";

export function getStoredCart() {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function saveCart(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // localStorage unavailable (privacy mode etc.) — silently skip
  }
}

export function clearStoredCart() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}