import { useCallback, useEffect, useState } from "react";
import {
  fetchQuotesForAdmin, fetchQuoteStatusCounts, setQuoteStatus,
} from "../lib/whatsappQuotesAdmin.js";

/**
 * useAdminWhatsappQuotes — queue list + tab counts.
 *
 * Optimistic status changes: when the rep changes status of a quote
 * to something outside the current tab, the row drops from view
 * immediately, then counts refresh.
 */
export function useAdminWhatsappQuotes(initialStatus = "new") {
  const [status, setStatus]   = useState(initialStatus);
  const [quotes, setQuotes]   = useState([]);
  const [counts, setCounts]   = useState({ new: 0, contacted: 0, confirmed: 0, lost: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [listRes, cntRes] = await Promise.all([
      fetchQuotesForAdmin({ status }),
      fetchQuoteStatusCounts(),
    ]);
    setLoading(false);
    if (listRes.ok) {
      setQuotes(listRes.quotes);
      setError(null);
    } else {
      setError(listRes.error);
    }
    if (cntRes.ok) setCounts(cntRes.counts);
  }, [status]);

  useEffect(() => { refresh(); }, [refresh]);

  const changeStatus = useCallback(async (quoteId, nextStatus) => {
    // Optimistic: drop from view if it's moving out of current filter
    if (status !== "all" && status !== nextStatus) {
      setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
    }
    const res = await setQuoteStatus(quoteId, nextStatus);
    if (!res.ok) {
      setError(res.error);
      refresh();
      return res;
    }
    fetchQuoteStatusCounts().then((c) => c.ok && setCounts(c.counts));
    return res;
  }, [status, refresh]);

  return { status, setStatus, quotes, counts, loading, error, refresh, changeStatus };
}