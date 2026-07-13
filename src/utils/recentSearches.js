/**
 * Recent searches — kept in localStorage so the search dropdown
 * can offer "your recent searches" when the input is focused but
 * empty. Capped at 8 to stay focused; older entries roll off.
 * Same pattern as recentlyViewed.js and cartPersistence.js.
 */
const KEY = "voltory_recent_searches";
const MAX = 8;

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query) {
  const q = (query || "").trim();
  if (!q) return;
  try {
    const current = getRecentSearches();
    // De-dupe (case-insensitive) and put the latest at the top
    const filtered = current.filter((s) => s.toLowerCase() !== q.toLowerCase());
    const next = [q, ...filtered].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

export function removeRecentSearch(query) {
  try {
    const next = getRecentSearches().filter((s) => s !== query);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}