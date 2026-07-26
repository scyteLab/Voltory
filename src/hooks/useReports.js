import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Reports data hook. Reads:
 *   \u00B7 orders in the date range (for revenue chart + totals)
 *   \u00B7 top_products_by_units (view)
 *   \u00B7 orders_status_breakdown (view)
 *
 * `rangeDays` accepts 30 / 90 / 365. The chart aggregates orders
 * to daily buckets client-side (Supabase has no built-in date_trunc
 * on client). This scales fine into the low thousands of orders \u2014
 * beyond that we'd move to a server-side view.
 */
export function useReports(rangeDays = 30, refreshTick = 0) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - rangeDays);
        const sinceIso = since.toISOString();

        const [ordersRes, topRes, breakdownRes] = await Promise.all([
          supabase.from("orders")
            .select("id, total, status, created_at")
            .gte("created_at", sinceIso)
            .neq("status", "cancelled")
            .order("created_at", { ascending: true }),
          supabase.from("top_products_by_units").select("*").limit(10),
          supabase.from("orders_status_breakdown").select("*"),
        ]);

        for (const r of [ordersRes, topRes, breakdownRes]) {
          if (r.error) throw r.error;
        }
        if (cancelled) return;

        const orders = ordersRes.data || [];

        // Aggregate orders by day
        const dailyMap = new Map();
        for (let i = 0; i <= rangeDays; i++) {
          const d = new Date();
          d.setDate(d.getDate() - (rangeDays - i));
          const key = d.toISOString().slice(0, 10);
          dailyMap.set(key, { day: key, revenue: 0, orders: 0 });
        }
        for (const o of orders) {
          const key = String(o.created_at).slice(0, 10);
          const bucket = dailyMap.get(key);
          if (bucket) {
            bucket.revenue += Number(o.total || 0);
            bucket.orders += 1;
          }
        }
        const daily = Array.from(dailyMap.values());

        const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
        const orderCount = orders.length;

        setState({
          loading: false,
          error: null,
          data: {
            rangeDays,
            daily,
            totalRevenue,
            orderCount,
            topProducts: topRes.data || [],
            statusBreakdown: breakdownRes.data || [],
          },
        });
      } catch (err) {
        if (cancelled) return;
        setState({ loading: false, error: err.message || String(err), data: null });
      }
    })();

    return () => { cancelled = true; };
  }, [rangeDays, refreshTick]);

  return state;
}

/**
 * Client-side CSV export helper. Fetches all rows from a table
 * with a subset of columns, then produces a downloadable CSV
 * blob. Used by both orders and customers export buttons.
 *
 * Uses the "Export as CSV" pattern rather than server-side generation
 * because we want it to just work \u2014 no edge function needed yet.
 */
export async function exportTableToCsv({ table, columns, filename, orderBy }) {
  const q = supabase.from(table).select(columns.join(","));
  if (orderBy) q.order(orderBy.col, { ascending: orderBy.dir === "asc" });
  const { data, error } = await q;
  if (error) throw error;

  const escapeCell = (v) => {
    if (v == null) return "";
    let s;
    if (typeof v === "object") s = JSON.stringify(v);
    else s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const header = columns.join(",");
  const body = (data || [])
    .map((row) => columns.map((c) => escapeCell(row[c])).join(","))
    .join("\n");
  const csv = header + "\n" + body;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { rows: data?.length || 0 };
}