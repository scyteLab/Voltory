import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadCatalog } from "../lib/catalogClient.js";
import { setSnapshot } from "../lib/catalogSnapshot.js";

/**
 * CatalogProvider
 *
 * Loads the storefront catalog once on mount. Every page reads via
 * useCatalog(), which returns helpers with the exact same API as
 * the old src/data/products.js exports so we can migrate pages one
 * at a time:
 *
 *   const { products, categories, brands, bySku, byCategory, byBrand,
 *           getDeals, loading, error, source, refresh } = useCatalog();
 *
 * "Refresh on window focus" is a small win: an admin who edits a
 * product and switches back to the storefront tab sees the change
 * within ~500ms without a manual reload.
 *
 * Deliberately NOT here (yet):
 *   · Real-time subscriptions (Supabase channel) — more moving parts,
 *     not needed for a single-operator shop yet.
 *   · Per-page fetches or pagination — catalog is small enough to
 *     ship in one payload.
 */

const Ctx = createContext(null);

const INITIAL = {
  products: [],
  categories: [],
  brands: [],
  loading: true,
  error: null,
  source: null,
};

export function CatalogProvider({ children }) {
  const [state, setState] = useState(INITIAL);
  // Guard against back-to-back focus refreshes (window focus fires often)
  const lastFetchRef = useRef(0);

  const fetchNow = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setState((s) => ({ ...s, loading: true }));
    const bundle = await loadCatalog();
    lastFetchRef.current = Date.now();
    setSnapshot({
      products:   bundle.products,
      categories: bundle.categories,
      brands:     bundle.brands,
    });
    setState({
      products:   bundle.products,
      categories: bundle.categories,
      brands:     bundle.brands,
      source:     bundle.source,
      loading:    false,
      error:      bundle.error,
    });
  }, []);

  // Initial load
  useEffect(() => {
    fetchNow();
  }, [fetchNow]);

  // Refresh on window focus (throttled to once per 30s so quick tab
  // flips don't hammer Supabase)
  useEffect(() => {
    function onFocus() {
      if (Date.now() - lastFetchRef.current < 30_000) return;
      fetchNow({ silent: true });
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchNow]);

  // Memoized helpers that mirror the old src/data/products.js API.
  // Because we depend on state.products/categories/brands, every helper
  // reference is stable across the SAME data snapshot — which is what
  // components memoizing on these expect.
  const helpers = useMemo(() => {
    const { products, categories, brands } = state;
    return {
      bySku:      (sku)   => products.find((p) => p.sku === sku) || null,
      bySlug:     (slug)  => products.find((p) => p.slug === slug) || null,
      byCategory: (catId) => products.filter((p) => p.category === catId),
      byBrand:    (brand) => products.filter((p) => p.brand === brand),
      byId:       (catId) => categories.find((c) => c.id === catId) || null,
      brandById:  (id)    => brands.find((b) => b.id === id) || null,
      /** Look up a brand by id OR case-insensitive display name. */
      findBrand:  (idOrName) => {
        if (!idOrName) return null;
        const k = String(idOrName).toLowerCase();
        return brands.find((b) => b.id === k || String(b.name).toLowerCase() === k) || null;
      },
      /** Deals = anything with a `was` price (a struck-through original). */
      getDeals: () => products.filter((p) => p.was),
    };
  }, [state]);

  const value = useMemo(() => ({
    products:   state.products,
    categories: state.categories,
    brands:     state.brands,
    loading:    state.loading,
    error:      state.error,
    source:     state.source,
    refresh:    () => fetchNow(),
    ...helpers,
  }), [state, helpers, fetchNow]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog() {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error(
      "useCatalog must be used inside <CatalogProvider>. Wrap the app in App.jsx."
    );
  }
  return v;
}