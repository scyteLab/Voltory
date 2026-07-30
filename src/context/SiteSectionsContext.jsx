import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { loadSiteSections } from "../lib/siteSectionsClient.js";

/**
 * SiteSectionsProvider
 *
 * Loads the homepage layout once on mount, refreshes on window focus
 * (throttled to 30s). Same pattern as CatalogContext.
 *
 * When Session 31b lands the admin UI, it can call `refresh()` after
 * saving changes so operators see updates instantly without a full
 * reload.
 */

const Ctx = createContext(null);

export function SiteSectionsProvider({ children }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);

  const fetchNow = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    const res = await loadSiteSections();
    lastFetchRef.current = Date.now();
    setSections(res.sections);
    setSource(res.source);
    setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => { fetchNow(); }, [fetchNow]);

  useEffect(() => {
    function onFocus() {
      if (Date.now() - lastFetchRef.current < 30_000) return;
      fetchNow({ silent: true });
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchNow]);

  const value = {
    sections,
    loading,
    source,
    error,
    refresh: () => fetchNow(),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSiteSections() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSiteSections must be used inside <SiteSectionsProvider>");
  return v;
}