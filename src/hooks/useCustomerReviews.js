import { useCallback, useEffect, useState } from "react";
import { fetchCustomerReviews, deleteReview } from "../lib/reviewsClient.js";
import { useCustomerAuth } from "../context/AuthContext.jsx";

/**
 * useCustomerReviews \u2014 the "My Reviews" page.
 * Loads all reviews written by the current customer (all statuses)
 * so they can see pending / approved / rejected states.
 */
export function useCustomerReviews() {
  const { customer } = useCustomerAuth();
  const customerId = customer?.id || null;

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    if (!customerId) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetchCustomerReviews(customerId);
    setLoading(false);
    if (res.ok) {
      setReviews(res.reviews);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [customerId]);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (reviewId) => {
    const res = await deleteReview(customerId, reviewId);
    if (res.ok) setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    return res;
  }, [customerId]);

  return { reviews, loading, error, refresh, remove };
}