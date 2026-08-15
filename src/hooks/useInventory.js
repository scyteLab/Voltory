import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchInventoryRows } from "../lib/inventoryClient.js";

/**
 * useInventory — loads inventory rows and exposes filter + sort
 * state. Filtering/sorting done client-side because inventory
 * tables are bounded (hundreds of products, not millions) and
 * doing it locally means instant filter response with no reload.
 *
 * Filters:
 *   status: "all" | "out" | "low" | "ok"
 *   categoryId: string | ""
 *   brand:      string | ""
 *   query:      free text (SKU or name substring)
 *
 * Sort:
 *   "stock-asc" (default) | "stock-desc" | "name-asc" | "name-desc"
 */
export function useInventory() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const [status, setStatus]     = useState("all");
  const [categoryId, setCat]    = useState("");
  const [brand, setBrand]       = useState("");
  const [query, setQuery]       = useState("");
  const [sort, setSort]         = useState("stock-asc");

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetchInventoryRows();
    setLoading(false);
    if (res.ok) {
      setAllRows(res.rows);
      setError(null);
    } else {
      setError(res.error);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Derived: counts per status — shown in the summary strip
  const counts = useMemo(() => {
    const c = { total: allRows.length, out: 0, low: 0, ok: 0 };
    for (const r of allRows) c[r.status]++;
    return c;
  }, [allRows]);

  // Distinct facets for the filter dropdowns
  const facets = useMemo(() => {
    const cats = new Set(), brands = new Set();
    for (const r of allRows) {
      if (r.categoryId) cats.add(r.categoryId);
      if (r.brand) brands.add(r.brand);
    }
    return {
      categories: Array.from(cats).sort(),
      brands: Array.from(brands).sort(),
    };
  }, [allRows]);

  const filtered = useMemo(() => {
    let arr = allRows;
    if (status !== "all")   arr = arr.filter((r) => r.status === status);
    if (categoryId)         arr = arr.filter((r) => r.categoryId === categoryId);
    if (brand)              arr = arr.filter((r) => r.brand === brand);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter((r) =>
        r.sku.toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q)
      );
    }
    // Sort
    const sorted = [...arr];
    switch (sort) {
      case "stock-desc": sorted.sort((a, b) => b.stock - a.stock); break;
      case "name-asc":   sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
      case "name-desc":  sorted.sort((a, b) => (b.name || "").localeCompare(a.name || "")); break;
      case "stock-asc":
      default:           sorted.sort((a, b) => a.stock - b.stock); break;
    }
    return sorted;
  }, [allRows, status, categoryId, brand, query, sort]);

  return {
    rows: filtered,
    allRows,
    counts,
    facets,
    loading,
    error,
    refresh,
    // Filter/sort state
    status,     setStatus,
    categoryId, setCategoryId: setCat,
    brand,      setBrand,
    query,      setQuery,
    sort,       setSort,
  };
}