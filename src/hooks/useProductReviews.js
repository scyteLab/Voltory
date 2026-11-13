import { useCallback, useEffect, useRef, useState } from "react";
import {
  REVIEWS_PAGE_SIZE, checkReviewEligibility, deleteReview, fetchProductReviews, fetchReviewSummary, upsertReview,
} from "../lib/reviewsClient.js";
import { useCustomerAuth } from "../context/AuthContext.jsx";

/**
 * useProductReviews — everything the product page needs:
 *
 *   summary          { average, total, stars:{5..1} }  approved only
 *   reviews          current page(s) of approved reviews
 *   starFilter       null | 1..5     setStarFilter()
 *   sort             newest|highest|lowest   setSort()
 *   hasMore, loadMore(), listLoading
 *   seoReviews       up to 5 newest approved (for structured data)
 *   me               { loading, canReview, existingReview, reason }
 *   submitReview(), removeReview()
 *
 * Public data comes from the approved-only RPCs; eligibility and
 * writes go through customer-data (server-checked).
 */
export function useProductReviews(productSku) {
  const { customer } = useCustomerAuth();
  const customerId = customer?.id || null;

  const [summary, setSummary]       = useState({ average: 0, total: 0, stars: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [reviews, setReviews]       = useState([]);
  const [seoReviews, setSeoReviews] = useState([]);
  const [starFilter, setStarFilter] = useState(null);
  const [sort, setSort]             = useState("newest");
  const [listLoading, setListLoading] = useState(true);
  const [error, setError]           = useState(null);
  const [me, setMe] = useState({ loading: false, canReview: false, existingReview: null, reason: null });
  const listReq = useRef(0);

  /* Summary + SEO sample: once per product. */
  useEffect(() => {
    if (!productSku) return undefined;
    let live = true;
    setSummaryLoaded(false);
    Promise.all([
      fetchReviewSummary(productSku),
      fetchProductReviews(productSku, { limit: 5, sort: "newest" }),
    ]).then(([s, top]) => {
      if (!live) return;
      setSummary(s.summary);
      setSeoReviews(top.ok ? top.reviews : []);
      setSummaryLoaded(s.ok);
    });
    return () => { live = false; };
  }, [productSku]);

  /* List: first page whenever product, star filter or sort changes. */
  useEffect(() => {
    if (!productSku) return;
    const req = ++listReq.current;
    setListLoading(true);
    fetchProductReviews(productSku, { limit: REVIEWS_PAGE_SIZE, offset: 0, rating: starFilter, sort }).then((res) => {
      if (req !== listReq.current) return;
      setListLoading(false);
      setReviews(res.reviews);
      setError(res.ok ? null : res.error);
    });
  }, [productSku, starFilter, sort]);

  const loadMore = useCallback(async () => {
    const req = ++listReq.current;
    setListLoading(true);
    const res = await fetchProductReviews(productSku, {
      limit: REVIEWS_PAGE_SIZE, offset: reviews.length, rating: starFilter, sort,
    });
    if (req !== listReq.current) return;
    setListLoading(false);
    if (res.ok) {
      setReviews((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...res.reviews.filter((r) => !seen.has(r.id))];
      });
    } else {
      setError(res.error);
    }
  }, [productSku, reviews.length, starFilter, sort]);

  /* Signed-in customer's eligibility + own review. */
  const refreshMe = useCallback(async () => {
    if (!productSku || !customerId) {
      setMe({ loading: false, canReview: false, existingReview: null, reason: null });
      return;
    }
    setMe((m) => ({ ...m, loading: true }));
    const res = await checkReviewEligibility(productSku);
    setMe({
      loading: false,
      canReview: res.canReview,
      existingReview: res.existingReview,
      reason: res.ok ? res.reason : "error",
    });
  }, [productSku, customerId]);

  useEffect(() => { refreshMe(); }, [refreshMe]);

  const submitReview = useCallback(async ({ rating, title, body }) => {
    if (!customerId) return { ok: false, error: "Please sign in first." };
    const res = await upsertReview({ sku: productSku, rating, title, body });
    if (res.ok) setMe((m) => ({ ...m, existingReview: res.review }));
    return res;
  }, [customerId, productSku]);

  const removeReview = useCallback(async () => {
    const res = await deleteReview(productSku);
    if (res.ok || res.status === 404) await refreshMe();
    return res;
  }, [productSku, refreshMe]);

  const filteredTotal = starFilter ? summary.stars[starFilter] || 0 : summary.total;

  return {
    summary,
    summaryLoaded,
    reviews,
    seoReviews,
    starFilter,
    setStarFilter,
    sort,
    setSort,
    listLoading,
    hasMore: reviews.length < filteredTotal,
    loadMore,
    error,
    me,
    submitReview,
    removeReview,
  };
}
