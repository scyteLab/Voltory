import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { countNewSubscribers } from "../lib/inboxAdmin.js";

/**
 * Lightweight polling hook for sidebar / topbar badges.
 * Fetches counts every 30 seconds. Keeps a stable state on
 * failure so a network hiccup doesn't clear the badges.
 *
 * Returns:
 *   { pendingOrders, openWarranty, pendingReviews, pendingQuestions,
 *     newQuotes, newInbox, lowStock, notifications }
 *
 * pendingQuestions = product questions waiting for an answer (0 until
 * supabase/product_questions.sql has run).
 *
 * newInbox = new contact messages + new form submissions + newsletter
 * signups since this admin last opened Inbox → Newsletter.
 */
export function useAdminCounters() {
  const [counts, setCounts] = useState({
    pendingOrders:  null,
    openWarranty:   null,
    pendingReviews: null,
    pendingQuestions: null,
    newQuotes:      null,
    newInbox:       null,
    lowStock:       null,
    notifications:  null,
  });

  useEffect(() => {
    let stopped = false;
    let timerId = null;

    async function pull() {
      try {
        const [{ data }, { count: newMessages }, { count: newSubmissions }, newSubscribers, { count: pendingQuestions }] = await Promise.all([
          supabase
            .from("dashboard_kpis")
            .select("pending_orders, open_warranty_claims, low_stock_count, pending_reviews, new_whatsapp_quotes")
            .maybeSingle(),
          // Contact-form inbox; not in dashboard_kpis, so counted directly.
          supabase
            .from("contact_messages")
            .select("id", { count: "exact", head: true })
            .eq("status", "new"),
          supabase
            .from("form_submissions")
            .select("id", { count: "exact", head: true })
            .eq("status", "new"),
          countNewSubscribers(),
          supabase
            .from("product_questions")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
        ]);
        const newInbox =
          Number(newMessages || 0) + Number(newSubmissions || 0) + Number(newSubscribers || 0);
        if (stopped || !data) return;
        // Notifications badge = every actionable item the admin
        // needs to look at, summed.
        const notifications =
          Number(data.pending_orders || 0) +
          Number(data.open_warranty_claims || 0) +
          Number(data.low_stock_count || 0) +
          Number(data.pending_reviews || 0) +
          Number(pendingQuestions || 0) +
          Number(data.new_whatsapp_quotes || 0) +
          newInbox;
        setCounts({
          pendingOrders:  Number(data.pending_orders || 0),
          openWarranty:   Number(data.open_warranty_claims || 0),
          pendingReviews: Number(data.pending_reviews || 0),
          pendingQuestions: Number(pendingQuestions || 0),
          newQuotes:      Number(data.new_whatsapp_quotes || 0),
          newInbox,
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