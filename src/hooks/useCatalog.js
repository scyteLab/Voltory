import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Catalog data hook.
 *
 * Owns:
 *   · the product list (paginated + filtered + sorted)
 *   · the list of brands / categories (for filter dropdowns)
 *   · loading + error state
 *   · mutations (upsertProduct, deleteProduct, setProductStatus)
 *
 * The filter shape:
 *   { search, categoryId, brandId, status, sort: {col, dir}, page, pageSize }
 *
 * Returns:
 *   { rows, total, brands, categories, loading, error, refresh,
 *     upsertProduct, deleteProduct, setProductStatus }
 */
const DEFAULT_PAGE_SIZE = 10;

export function useCatalog(filters) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  // Load brands + categories once (small tables, don't refetch on filter change)
  useEffect(() => {
    (async () => {
      try {
        const [b, c] = await Promise.all([
          supabase.from("brands").select("id, name").order("name"),
          supabase.from("categories").select("id, label").order("label"),
        ]);
        if (b.error) throw b.error;
        if (c.error) throw c.error;
        setBrands(b.data || []);
        setCategories(c.data || []);
      } catch (e) {
        setError(e.message || String(e));
      }
    })();
  }, []);

  // Load the product page whenever filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const pageSize = filters.pageSize || DEFAULT_PAGE_SIZE;
      const page = Math.max(0, (filters.page || 1) - 1);
      const from = page * pageSize;
      const to = from + pageSize - 1;

      try {
        let q = supabase
          .from("products")
          .select("*", { count: "exact" });

        // Search across name + sku
        if (filters.search && filters.search.trim()) {
          const term = filters.search.trim();
          q = q.or(`name.ilike.%${term}%,sku.ilike.%${term}%,model.ilike.%${term}%`);
        }
        if (filters.categoryId) q = q.eq("category", filters.categoryId);
        if (filters.brandId)    q = q.eq("brand",    filters.brandId);
        if (filters.status)     q = q.eq("status",   filters.status);

        // Stock filter: allow synthetic "low" and "out" as UI values
        if (filters.stockBand === "low") q = q.gt("stock", 0).lte("stock", 10);
        if (filters.stockBand === "out") q = q.eq("stock", 0);

        // Sort
        const sort = filters.sort || { col: "updated_at", dir: "desc" };
        q = q.order(sort.col, { ascending: sort.dir === "asc" });

        // Paginate
        q = q.range(from, to);

        const { data, count, error: err } = await q;
        if (err) throw err;
        if (cancelled) return;
        setRows(data || []);
        setTotal(count || 0);
      } catch (e) {
        if (cancelled) return;
        setError(e.message || String(e));
        setRows([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [
    filters.search, filters.categoryId, filters.brandId, filters.status,
    filters.stockBand, filters.sort?.col, filters.sort?.dir,
    filters.page, filters.pageSize, tick,
  ]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  /**
   * Upsert a product. If sku is present it updates; if it's a brand
   * new SKU it inserts. Supabase upsert() handles both. Returns the
   * saved row (with server-set updated_at).
   */
  const upsertProduct = useCallback(async (patch) => {
    // Strip fields Supabase manages (updated_at) so triggers do their job
    const { updated_at: _drop, created_at: _drop2, ...clean } = patch;
    const { data, error: err } = await supabase
      .from("products")
      .upsert(clean, { onConflict: "sku" })
      .select()
      .single();
    if (err) throw err;
    refresh();
    return data;
  }, [refresh]);

  const deleteProduct = useCallback(async (sku) => {
    const { error: err } = await supabase.from("products").delete().eq("sku", sku);
    if (err) throw err;
    refresh();
  }, [refresh]);

  const setProductStatus = useCallback(async (sku, status) => {
    const { error: err } = await supabase
      .from("products").update({ status }).eq("sku", sku);
    if (err) throw err;
    refresh();
  }, [refresh]);

  /**
   * Bulk delete a set of SKUs. Uses .in() so it's a single DB call.
   * Returns { count } on success.
   */
  const bulkDelete = useCallback(async (skus) => {
    if (!skus?.length) return { count: 0 };
    const { error: err } = await supabase
      .from("products").delete().in("sku", skus);
    if (err) throw err;
    refresh();
    return { count: skus.length };
  }, [refresh]);

  /**
   * Bulk status change (Set Active / Set Inactive).
   */
  const bulkSetStatus = useCallback(async (skus, status) => {
    if (!skus?.length) return { count: 0 };
    const { error: err } = await supabase
      .from("products").update({ status }).in("sku", skus);
    if (err) throw err;
    refresh();
    return { count: skus.length };
  }, [refresh]);

  return useMemo(() => ({
    rows, total, brands, categories, loading, error,
    refresh, upsertProduct, deleteProduct, setProductStatus,
    bulkDelete, bulkSetStatus,
  }), [rows, total, brands, categories, loading, error,
      refresh, upsertProduct, deleteProduct, setProductStatus,
      bulkDelete, bulkSetStatus]);
}

/**
 * Fetch a single product by SKU. Used when we deep-link
 * `?focus=VAC-0015INV` from the ⌘K palette — the focused product
 * needs to open in the edit panel even if it isn't on the current
 * page of the paginated list.
 */
export async function fetchProductBySku(sku) {
  const { data, error } = await supabase
    .from("products").select("*").eq("sku", sku).maybeSingle();
  if (error) throw error;
  return data;
}