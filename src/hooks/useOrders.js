import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Orders list hook.
 *
 * Filters shape:
 *   { search, status, dateFrom, dateTo,
 *     sort: {col, dir}, page, pageSize }
 *
 * search matches: id (order code) or customer_name.
 * dateFrom / dateTo are ISO date strings (YYYY-MM-DD); inclusive.
 */
const DEFAULT_PAGE_SIZE = 15;

export function useOrders(filters) {
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
        let q = supabase
          .from("orders")
          .select("*", { count: "exact" });

        if (filters.search && filters.search.trim()) {
          const term = filters.search.trim();
          q = q.or(`id.ilike.%${term}%,customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%`);
        }
        if (filters.status)   q = q.eq("status", filters.status);
        if (filters.dateFrom) q = q.gte("created_at", `${filters.dateFrom}T00:00:00`);
        if (filters.dateTo)   q = q.lte("created_at", `${filters.dateTo}T23:59:59`);

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
    filters.search, filters.status, filters.dateFrom, filters.dateTo,
    filters.sort?.col, filters.sort?.dir,
    filters.page, filters.pageSize, tick,
  ]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return useMemo(() => ({
    rows, total, loading, error, refresh,
  }), [rows, total, loading, error, refresh]);
}

/**
 * Fetch a single order with its line items. Used by the detail
 * page. Line items are looked up in a separate query — kept as
 * two roundtrips instead of a join because Supabase's postgrest
 * embed syntax gets awkward for a one-to-many with additional
 * ordering, and separate queries are just as fast at this scale.
 */
export async function fetchOrderWithItems(id) {
  const [orderRes, itemsRes] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id),
  ]);
  if (orderRes.error) throw orderRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (!orderRes.data) return null;
  return {
    ...orderRes.data,
    items: itemsRes.data || [],
  };
}

/**
 * Transition an order's status. Server-side triggers handle updated_at.
 */
export async function setOrderStatus(id, status) {
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}