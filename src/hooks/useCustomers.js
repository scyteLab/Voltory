import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Customers list hook. Reads from `customers_summary` view.
 *
 * Filters shape:
 *   { search, tag, sort: {col, dir}, page, pageSize }
 *
 * `search` matches name / phone / email (case-insensitive).
 * `tag` is one of: "", "vip", "repeat", "new", "standard".
 */
const DEFAULT_PAGE_SIZE = 20;

export function useCustomers(filters) {
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
        let q = supabase.from("customers_summary").select("*", { count: "exact" });

        if (filters.search && filters.search.trim()) {
          const term = filters.search.trim();
          q = q.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
        }
        if (filters.tag) q = q.eq("tag", filters.tag);

        const sort = filters.sort || { col: "last_order_at", dir: "desc" };
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
    filters.search, filters.tag,
    filters.sort?.col, filters.sort?.dir,
    filters.page, filters.pageSize, tick,
  ]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  return useMemo(() => ({
    rows, total, loading, error, refresh,
  }), [rows, total, loading, error, refresh]);
}

/**
 * Fetch a single customer's summary + all their orders. Detail page uses this.
 * `phone` should be URL-safe (typically the plain digits string).
 */
export async function fetchCustomerWithOrders(phone) {
  const [summaryRes, ordersRes] = await Promise.all([
    supabase.from("customers_summary").select("*").eq("phone", phone).maybeSingle(),
    supabase.from("orders").select("*").eq("customer_phone", phone).order("created_at", { ascending: false }),
  ]);
  if (summaryRes.error) throw summaryRes.error;
  if (ordersRes.error)  throw ordersRes.error;
  if (!summaryRes.data) return null;
  return {
    ...summaryRes.data,
    orders: ordersRes.data || [],
  };
}