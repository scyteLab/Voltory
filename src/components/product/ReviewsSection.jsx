import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Pencil, Star, Trash2, X } from "lucide-react";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import { REVIEW_SORTS } from "../../lib/reviewsClient.js";
import ReviewCard from "./ReviewCard.jsx";
import ReviewForm from "./ReviewForm.jsx";

const STATUS_TEXT = { pending: "Pending approval", approved: "Published", rejected: "Not published" };

function Stars({ value, size = 18 }) {
  const full = Math.round(value);
  return (
    <span className="revs__bigstars" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} aria-hidden="true"
              fill={n <= full ? "#f59e0b" : "none"} stroke={n <= full ? "#f59e0b" : "#cbd5e1"} />
      ))}
    </span>
  );
}

/**
 * ReviewsSection — "Customer Reviews" on the product page.
 *
 * `reviews` is the useProductReviews() result (Product.jsx owns it so
 * the same data feeds the structured data). Only approved reviews are
 * shown or counted. Writing is for signed-in customers whose order
 * containing this product was delivered (checked on the server).
 *
 * Opening /product/<slug>#write-review opens the form (links from
 * My Orders and My Reviews).
 */
export default function ReviewsSection({ productName, productSlug, reviews: r }) {
  const { customer } = useCustomerAuth();
  const location = useLocation();
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef(null);

  const { summary, me } = r;
  const existing = me.existingReview;
  const total = summary.total;
  const maxStar = Math.max(1, ...[5, 4, 3, 2, 1].map((n) => summary.stars[n] || 0));

  // #write-review → open the form once eligibility is known.
  useEffect(() => {
    if (location.hash !== "#write-review" || !customer || me.loading) return;
    if (me.canReview) setFormOpen(true);
    const el = document.getElementById("write-review");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, customer, me.loading, me.canReview]);

  useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [formOpen]);

  async function handleSubmit(input) {
    const res = await r.submitReview(input);
    if (res.ok) {
      setFormOpen(false);
      setNotice("Thanks! Your review will appear after a quick check by our team.");
    }
    return res;
  }

  async function handleDelete() {
    if (!window.confirm("Delete your review? This cannot be undone.")) return;
    setBusy(true);
    const res = await r.removeReview();
    setBusy(false);
    setNotice(res.ok ? "Your review was deleted." : res.error);
  }

  const returnTo = `/product/${productSlug}#write-review`;

  return (
    <section className="revs" aria-labelledby="reviews-heading">
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2 id="reviews-heading">Customer Reviews</h2>
      </div>

      <div className="revs__summary">
        {/* Average */}
        <div className="revs__big">
          {total > 0 ? (
            <>
              <span className="revs__bignum">{summary.average.toFixed(1)}</span>
              <Stars value={summary.average} />
              <small className="revs__count">Based on {total} rating{total === 1 ? "" : "s"}</small>
            </>
          ) : (
            <>
              <span className="revs__bignum revs__bignum--empty">–</span>
              <small className="revs__count">No ratings yet</small>
            </>
          )}
        </div>

        {/* 5★ → 1★ bars; click to filter */}
        <ul className="revs__bars" aria-label="Ratings by star">
          {[5, 4, 3, 2, 1].map((n) => {
            const count = summary.stars[n] || 0;
            const on = r.starFilter === n;
            return (
              <li key={n}>
                <button
                  type="button"
                  className={"revs__bar" + (on ? " revs__bar--on" : "")}
                  aria-pressed={on}
                  disabled={count === 0 && !on}
                  onClick={() => r.setStarFilter(on ? null : n)}
                  aria-label={`${n} star${n === 1 ? "" : "s"}: ${count} rating${count === 1 ? "" : "s"}${on ? " (showing only these)" : ""}`}
                >
                  <span className="revs__bar-lbl">{n} <Star size={11} fill="currentColor" strokeWidth={0} aria-hidden="true" /></span>
                  <span className="revs__bar-track" aria-hidden="true">
                    <span className="revs__bar-fill" style={{ width: `${(count / maxStar) * 100}%` }} />
                  </span>
                  <span className="revs__bar-n">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Call to action */}
        <div className="revs__cta" id="write-review">
          {!customer && (
            <div className="revs__gate">
              <p>Received this product?</p>
              <Link to={`/login?return=${encodeURIComponent(returnTo)}`} className="btn-shop">Sign in to review</Link>
            </div>
          )}

          {customer && me.loading && <p className="revs__gate-text">Checking…</p>}

          {customer && !me.loading && existing && (
            <div className="revs__yours">
              <div className="revs__yours-top">
                <b>Your review</b>
                <span className={`revs__status revs__status--${existing.status}`}>
                  {STATUS_TEXT[existing.status] || existing.status}
                </span>
              </div>
              {existing.status === "rejected" && existing.adminNote && (
                <p className="revs__yours-note"><b>Reason:</b> {existing.adminNote}</p>
              )}
              <div className="revs__yours-actions">
                {me.canReview && !formOpen && (
                  <button type="button" className="btn-ghost" onClick={() => { setNotice(null); setFormOpen(true); }}>
                    <Pencil size={13} /> Edit
                  </button>
                )}
                <button type="button" className="btn-ghost btn-ghost--danger" onClick={handleDelete} disabled={busy}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          )}

          {customer && !me.loading && !existing && me.canReview && !formOpen && (
            <button type="button" className="btn-shop" onClick={() => { setNotice(null); setFormOpen(true); }}>
              <Star size={14} /> Rate this product
            </button>
          )}

          {customer && !me.loading && !existing && !me.canReview && (
            <p className="revs__gate-text">
              {me.reason === "error"
                ? "We couldn't check your purchase right now. Please refresh to try again."
                : "Only customers who received this product can review it."}
            </p>
          )}
        </div>
      </div>

      {notice && <div className="revs__notice" role="status">{notice}</div>}

      {formOpen && (
        <div className="revs__formwrap" ref={formRef}>
          <h3>{existing ? "Edit your review" : `Rate: ${productName}`}</h3>
          <ReviewForm existingReview={existing} onSubmit={handleSubmit} onCancel={() => setFormOpen(false)} />
        </div>
      )}

      {/* List */}
      {total > 0 && (
        <div className="revs__toolbar">
          <span className="revs__showing">
            {r.starFilter ? (
              <button type="button" className="revs__chip" onClick={() => r.setStarFilter(null)}>
                {r.starFilter}-star reviews <X size={12} aria-label="Show all" />
              </button>
            ) : (
              `${total} review${total === 1 ? "" : "s"}`
            )}
          </span>
          <label className="revs__sort">
            Sort by{" "}
            <select value={r.sort} onChange={(e) => r.setSort(e.target.value)}>
              {REVIEW_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>
      )}

      {r.listLoading && r.reviews.length === 0 ? (
        <div className="revs__loading">Loading reviews…</div>
      ) : r.reviews.length === 0 ? (
        <div className="revs__empty">
          <MessageSquare size={36} strokeWidth={1.2} />
          <p>
            {total === 0
              ? "No reviews yet. Customers who received this product can rate it here."
              : "No reviews match this filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="revs__list">
            {r.reviews.map((rev) => <ReviewCard key={rev.id} review={rev} />)}
          </div>
          {r.hasMore && (
            <div className="revs__more">
              <button type="button" className="btn-ghost" onClick={r.loadMore} disabled={r.listLoading}>
                {r.listLoading ? "Loading…" : "Load more reviews"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
