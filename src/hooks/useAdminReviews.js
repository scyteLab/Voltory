import { useCallback, useEffect, useState } from "react";
import {
  fetchReviewsForAdmin, fetchReviewStatusCounts,
  setReviewStatus, deleteReviewAsAdmin,
} from "../lib/reviewsAdmin.js";

/**
 * useAdminReviews — loads reviews for the queue, filtered by
 * status, plus per-status counts for the tabs.
 *
 * Mutations are optimistic: approve/reject removes the row from
 * the current filtered list immediately (since it changed status),
 * then refetches counts.
 */
export function useAdminReviews(initialStatus = "pending") {
  const [status, setStatus]   = useState(initialStatus);
  const [reviews, setReviews] = useState([]);
  const [counts, setCounts]   = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [listRes, cntRes] = await Promise.all([
      fetchReviewsForAdmin({ status }),
      fetchReviewStatusCounts(),
    ]);
    setLoading(false);
    if (listRes.ok) {
      setReviews(listRes.reviews);
      setError(null);
    } else {
      setError(listRes.error);
    }
    if (cntRes.ok) setCounts(cntRes.counts);
  }, [status]);

  useEffect(() => { refresh(); }, [refresh]);

  const approve = useCallback(async (id) => {
    // Optimistically drop from the current view if we're not on "All"
    if (status !== "all" && status !== "approved") {
      setReviews((prev) => prev.filter((r) => r.id !== id));
    }
    const res = await setReviewStatus(id, "approved");
    if (!res.ok) { setError(res.error); refresh(); return res; }
    // Refresh counts without a full list refetch
    fetchReviewStatusCounts().then((c) => c.ok && setCounts(c.counts));
    return res;
  }, [status, refresh]);

  const reject = useCallback(async (id, adminNote) => {
    if (status !== "all" && status !== "rejected") {
      setReviews((prev) => prev.filter((r) => r.id !== id));
    }
    const res = await setReviewStatus(id, "rejected", adminNote);
    if (!res.ok) { setError(res.error); refresh(); return res; }
    fetchReviewStatusCounts().then((c) => c.ok && setCounts(c.counts));
    return res;
  }, [status, refresh]);

  const unapprove = useCallback(async (id) => {
    // Back to pending — useful for undoing an accidental approve
    if (status !== "all" && status !== "pending") {
      setReviews((prev) => prev.filter((r) => r.id !== id));
    }
    const res = await setReviewStatus(id, "pending");
    if (!res.ok) { setError(res.error); refresh(); return res; }
    fetchReviewStatusCounts().then((c) => c.ok && setCounts(c.counts));
    return res;
  }, [status, refresh]);

  const remove = useCallback(async (id) => {
    setReviews((prev) => prev.filter((r) => r.id !== id));
    const res = await deleteReviewAsAdmin(id);
    if (!res.ok) { setError(res.error); refresh(); return res; }
    fetchReviewStatusCounts().then((c) => c.ok && setCounts(c.counts));
    return res;
  }, [refresh]);

  return {
    status, setStatus,
    reviews, counts,
    loading, error,
    refresh, approve, reject, unapprove, remove,
  };
}