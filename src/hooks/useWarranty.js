import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

const DEFAULT_PAGE_SIZE = 15;

/**
 * Warranty claims list hook.
 *
 * Filters: { search, status, sort: {col, dir}, page, pageSize }
 */
export function useWarranty(filters) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

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
        let q = supabase.from("warranty_claims").select("*", { count: "exact" });

        if (filters.search && filters.search.trim()) {
          const term = filters.search.trim();
          q = q.or(`id.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,reason.ilike.%${term}%`);
        }
        if (filters.status) q = q.eq("status", filters.status);

        const sort = filters.sort || { col: "created_at", dir: "desc" };
        q = q.order(sort.col, { ascending: sort.dir === "asc" });
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
    filters.search, filters.status,
    filters.sort?.col, filters.sort?.dir,
    filters.page, filters.pageSize, tick,
  ]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return useMemo(() => ({
    rows, total, loading, error, refresh,
  }), [rows, total, loading, error, refresh]);
}

/**
 * Fetch a single warranty claim plus (when present) the related
 * order + product for context on the detail page.
 */
export async function fetchWarrantyWithContext(id) {
  const { data: claim, error } = await supabase
    .from("warranty_claims").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!claim) return null;

  // Best-effort fetches for related order + product. Don't fail the whole
  // detail page if a referenced row was later deleted.
  const [orderRes, productRes] = await Promise.all([
    claim.order_id
      ? supabase.from("orders").select("id, customer_name, total, status, created_at, address")
                .eq("id", claim.order_id).maybeSingle()
      : Promise.resolve({ data: null }),
    claim.sku
      ? supabase.from("products").select("sku, name, brand, category, image, price")
                .eq("sku", claim.sku).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    ...claim,
    order:   orderRes?.data || null,
    product: productRes?.data || null,
  };
}

/**
 * Move a claim to a new status. If moving to resolved, we also
 * write resolution text.
 */
export async function setWarrantyStatus(id, status, resolution) {
  const patch = { status };
  if (resolution !== undefined) patch.resolution = resolution;
  const { data, error } = await supabase
    .from("warranty_claims").update(patch).eq("id", id)
    .select().single();
  if (error) throw error;
  return data;
}