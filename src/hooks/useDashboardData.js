import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Single hook that fetches everything the dashboard needs.
 * Returns { loading, error, data } and re-fetches on `refreshTick`.
 *
 * We do the queries in parallel but wait on all of them so the
 * dashboard renders as a single unit rather than pop-in-per-widget.
 * If any query fails the whole set fails \u2014 the dashboard shows
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
            sales: salesRes.data || [],
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
 * When there is no prior period (last=0) we surface "\u2014" from the UI
 * rather than reporting +\u221E%.
 */
export function computeDelta(current, prior) {
  const c = Number(current || 0);
  const p = Number(prior || 0);
  if (!p) return { pct: null, direction: c > 0 ? "up" : "flat" };
  const pct = ((c - p) / p) * 100;
  const direction = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return { pct, direction };
}