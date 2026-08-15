import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Pencil, Star, Trash2 } from "lucide-react";
import { useProductReviews } from "../../hooks/useProductReviews.js";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import ReviewCard from "./ReviewCard.jsx";
import ReviewForm from "./ReviewForm.jsx";

/**
 * ReviewsSection — the "Customer Reviews" block on the product page.
 *
 * Renders:
 *   • Aggregate (average + count of approved reviews)
 *   • Write / Edit review CTA — gated to signed-in verified buyers
 *   • List of approved reviews
 *
 * States it handles honestly:
 *   · Signed out — shows "Sign in to leave a review" link
 *   · Signed in, hasn't bought — shows "Only verified buyers can review"
 *   · Signed in verified buyer, no review yet — "Write a review" button
 *   · Signed in with existing review — "Edit / Delete" + shows status
 */
export default function ReviewsSection({ productSku, productName }) {
  const { customer } = useCustomerAuth();
  const {
    reviews, aggregate, loading, canReview, existingReview,
    submitReview, removeReview,
  } = useProductReviews(productSku);

  const [formOpen, setFormOpen] = useState(false);

  async function handleSubmit(input) {
    const res = await submitReview(input);
    if (res.ok) setFormOpen(false);
    return res;
  }

  async function handleDelete() {
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    await removeReview();
  }

  const roundAvg = Math.round(aggregate.average * 10) / 10;

  return (
    <section className="revs" aria-labelledby="reviews-heading">
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2 id="reviews-heading">Customer Reviews</h2>
      </div>

      {/* Aggregate summary */}
      <div className="revs__summary">
        <div className="revs__big">
          <span className="revs__bignum">{roundAvg > 0 ? roundAvg.toFixed(1) : "–"}</span>
          <span className="revs__bigstars">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={18}
                fill={n <= Math.round(aggregate.average) ? "#f59e0b" : "none"}
                stroke={n <= Math.round(aggregate.average) ? "#f59e0b" : "#cbd5e1"}
              />
            ))}
          </span>
          <small className="revs__count">
            {aggregate.count === 0
              ? "No reviews yet"
              : `${aggregate.count} review${aggregate.count === 1 ? "" : "s"}`}
          </small>
        </div>

        {/* Right-hand CTA area */}
        <div className="revs__cta">
          {!customer && (
            <div className="revs__gate">
              <p>Have you bought this product?</p>
              <Link to="/login" className="btn-shop">Sign in to review</Link>
            </div>
          )}

          {customer && !canReview && !existingReview && (
            <div className="revs__gate">
              <p>Only customers who have purchased this product can leave a review.</p>
            </div>
          )}

          {customer && canReview && !existingReview && !formOpen && (
            <button
              type="button"
              className="btn-shop"
              onClick={() => setFormOpen(true)}
            >
              <Pencil size={14} /> Write a review
            </button>
          )}

          {customer && existingReview && !formOpen && (
            <div className="revs__yours">
              <b>Your review</b>
              <span className={`revs__status revs__status--${existingReview.status}`}>
                {existingReview.status === "approved" && "Published"}
                {existingReview.status === "pending"  && "Awaiting moderation"}
                {existingReview.status === "rejected" && "Not published"}
              </span>
              <div className="revs__yours-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setFormOpen(true)}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-ghost--danger"
                  onClick={handleDelete}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Write form */}
      {formOpen && (
        <div className="revs__formwrap">
          <h3>{existingReview ? "Edit your review" : `Reviewing: ${productName}`}</h3>
          <ReviewForm
            existingReview={existingReview}
            onSubmit={handleSubmit}
            onCancel={() => setFormOpen(false)}
          />
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="revs__loading">Loading reviews…</div>
      ) : reviews.length === 0 ? (
        <div className="revs__empty">
          <MessageSquare size={36} strokeWidth={1.2} />
          <p>Be the first to share your thoughts on this product.</p>
        </div>
      ) : (
        <div className="revs__list">
          {reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}
    </section>
  );
}