import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { lagosDay } from "../utils/format.js";

const SPARK_DAYS = 30;

/**
 * One point per day for the last 30 Nigerian days, oldest first, with
 * 0 for days that had no sales. The fixed sales_by_day view already
 * returns that; the old one skipped empty days and wasn't ordered,
 * which squashed the sparkline. Doing it here keeps both working.
 */
function fillSalesDays(rows) {
  const byDay = new Map(rows.map((r) => [String(r.day).slice(0, 10), r]));
  const out = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = lagosDay(d);
    const r = byDay.get(key);
    out.push({ day: key, revenue: Number(r?.revenue) || 0, order_count: Number(r?.order_count) || 0 });
  }
  return out;
}

/**
 * Single hook that fetches everything the dashboard needs.
 * Returns { loading, error, data } and re-fetches on `refreshTick`.
 *
 * We do the queries in parallel but wait on all of them so the
 * dashboard renders as a single unit rather than pop-in-per-widget.
 * If any query fails the whole set fails — the dashboard shows
 * an error state and a retry button.
 */
export function useDashboardData(refreshTick = 0) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));

    async function load() {
      try {
        const [kpisRes, salesRes, recentOrdersRes, lowStockRes, warrantyRes] = await Promise.all([
          supabase.from("dashboard_kpis").select("*").maybeSingle(),
          supabase.from("sales_by_day").select("*"),
          supabase.from("orders").select("id, created_at, customer_name, total, status")
            .order("created_at", { ascending: false }).limit(6),
          supabase.from("low_stock_products").select("*").limit(6),
          supabase.from("warranty_claims").select("id, created_at, customer_name, status, reason")
            .in("status", ["submitted", "under_review"])
            .order("created_at", { ascending: false }).limit(6),
        ]);

        // Fail loud on any query error
        for (const r of [kpisRes, salesRes, recentOrdersRes, lowStockRes, warrantyRes]) {
          if (r.error) throw r.error;
        }

        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          data: {
            kpis: kpisRes.data || {},
            sales: fillSalesDays(salesRes.data || []),
            recentOrders: recentOrdersRes.data || [],
            lowStock: lowStockRes.data || [],
            openWarranty: warrantyRes.data || [],
          },
        });
      } catch (err) {
        if (cancelled) return;
        setState({ loading: false, error: err.message || String(err), data: null });
      }
    }

    load();
    return () => { cancelled = true; };
  }, [refreshTick]);

  return state;
}

/**
 * Percent-change delta between two numbers, e.g. this month vs last.
 * Returns { pct, direction } where direction is "up" | "down" | "flat".
 * When there is no prior period (last=0) we surface "—" from the UI
 * rather than reporting +∞%.
 */
export function computeDelta(current, prior) {
  const c = Number(current || 0);
  const p = Number(prior || 0);
  if (!p) return { pct: null, direction: c > 0 ? "up" : "flat" };
  const pct = ((c - p) / p) * 100;
  const direction = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return { pct, direction };
}