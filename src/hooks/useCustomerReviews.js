import { useCallback, useEffect, useState } from "react";
import { deleteReview, fetchMyReviews } from "../lib/reviewsClient.js";
import { useCustomerAuth } from "../context/AuthContext.jsx";

/**
 * useCustomerReviews — the signed-in customer's own reviews (all
 * statuses) plus the delivered products still waiting for a review.
 * Used by My Account → Reviews and My Account → Orders.
 */
export function useCustomerReviews() {
  const { customer } = useCustomerAuth();
  const customerId = customer?.id || null;

  const [reviews, setReviews] = useState([]);
  const [pendingToReview, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    if (!customerId) {
      setReviews([]);
      setPending([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetchMyReviews();
    setLoading(false);
    setReviews(res.reviews);
    setPending(res.pendingToReview);
    setError(res.ok ? null : res.error);
  }, [customerId]);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (sku) => {
    const res = await deleteReview(sku);
    if (res.ok) refresh();
    return res;
  }, [refresh]);

  return { reviews, pendingToReview, loading, error, refresh, remove };
}
