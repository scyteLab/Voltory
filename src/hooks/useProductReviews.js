import { useCallback, useEffect, useState } from "react";
import { fetchProductReviews, checkReviewEligibility, upsertReview, deleteReview } from "../lib/reviewsClient.js";
import { useCustomerAuth } from "../context/AuthContext.jsx";

/**
 * useProductReviews — loads approved reviews + aggregate for a
 * product, plus checks whether the current signed-in customer is
 * eligible to write one (they've ordered it or already have a
 * review).
 *
 * Exposes:
 *   · reviews         approved list
 *   · aggregate       { average, count }
 *   · loading, error
 *   · canReview       signed-in customer eligibility
 *   · eligibleOrderId order to tag the review with
 *   · existingReview  current customer's review row (if any)
 *   · submitReview()  create/update
 *   · removeReview()  delete
 */
export function useProductReviews(productSku) {
  const { customer } = useCustomerAuth();
  const customerId = customer?.id || null;

  const [reviews, setReviews]         = useState([]);
  const [aggregate, setAggregate]     = useState({ average: 0, count: 0 });
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [eligibility, setEligibility] = useState({ canReview: false });

  const refresh = useCallback(async () => {
    if (!productSku) return;
    setLoading(true);
    const [pubRes, elRes] = await Promise.all([
      fetchProductReviews(productSku),
      customerId ? checkReviewEligibility(customerId, productSku) : Promise.resolve({ canReview: false }),
    ]);
    setLoading(false);
    if (pubRes.ok) {
      setReviews(pubRes.reviews);
      setAggregate(pubRes.aggregate);
      setError(null);
    } else {
      setError(pubRes.error);
    }
    setEligibility(elRes || { canReview: false });
  }, [productSku, customerId]);

  useEffect(() => { refresh(); }, [refresh]);

  const submitReview = useCallback(async ({ rating, title, body }) => {
    if (!customerId) return { ok: false, error: "Please sign in first" };
    const res = await upsertReview({
      customerId,
      productSku,
      orderId: eligibility.orderId,
      rating, title, body,
    });
    if (res.ok) refresh();
    return res;
  }, [customerId, productSku, eligibility.orderId, refresh]);

  const removeReview = useCallback(async () => {
    if (!customerId || !eligibility.existingReview) return { ok: false, error: "No review to remove" };
    const res = await deleteReview(customerId, eligibility.existingReview.id);
    if (res.ok) refresh();
    return res;
  }, [customerId, eligibility.existingReview, refresh]);

  return {
    reviews,
    aggregate,
    loading,
    error,
    canReview:       eligibility.canReview,
    existingReview:  eligibility.existingReview || null,
    submitReview,
    removeReview,
    refresh,
  };
}