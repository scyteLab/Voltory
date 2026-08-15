import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";

/**
 * Lightweight polling hook for sidebar / topbar badges.
 * Fetches counts every 30 seconds. Keeps a stable state on
 * failure so a network hiccup doesn't clear the badges.
 *
 * Returns:
 *   { pendingOrders, openWarranty, pendingReviews, notifications }
 */
export function useAdminCounters() {
  const [counts, setCounts] = useState({
    pendingOrders:  null,
    openWarranty:   null,
    pendingReviews: null,
    newQuotes:      null,
    lowStock:       null,
    notifications:  null,
  });

  useEffect(() => {
    let stopped = false;
    let timerId = null;

    async function pull() {
      try {
        const { data } = await supabase
          .from("dashboard_kpis")
          .select("pending_orders, open_warranty_claims, low_stock_count, pending_reviews, new_whatsapp_quotes")
          .maybeSingle();
        if (stopped || !data) return;
        // Notifications badge = every actionable item the admin
        // needs to look at, summed.
        const notifications =
          Number(data.pending_orders || 0) +
          Number(data.open_warranty_claims || 0) +
          Number(data.low_stock_count || 0) +
          Number(data.pending_reviews || 0) +
          Number(data.new_whatsapp_quotes || 0);
        setCounts({
          pendingOrders:  Number(data.pending_orders || 0),
          openWarranty:   Number(data.open_warranty_claims || 0),
          pendingReviews: Number(data.pending_reviews || 0),
          newQuotes:      Number(data.new_whatsapp_quotes || 0),
          lowStock:       Number(data.low_stock_count || 0),
          notifications,
        });
      } catch { /* keep the previous values */ }
    }

    pull();
    timerId = setInterval(pull, 30_000);
    return () => { stopped = true; clearInterval(timerId); };
  }, []);

  return counts;
}