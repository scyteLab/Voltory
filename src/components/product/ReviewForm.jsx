import { useState } from "react";
import { Star } from "lucide-react";

/**
 * ReviewForm — write or edit a review.
 * Interactive star picker + title + body. Body is required, title
 * optional. Body auto-focuses when the form opens.
 *
 * Every submit resets moderation to pending (server enforces),
 * so edited approved reviews disappear from public until re-approved.
 * We warn about this in the note under the submit button.
 */
export default function ReviewForm({ existingReview, onSubmit, onCancel }) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hover, setHover]   = useState(0);
  const [title, setTitle]   = useState(existingReview?.title || "");
  const [body, setBody]     = useState(existingReview?.body || "");
  const [error, setError]   = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!existingReview;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!rating) { setError("Please pick a rating"); return; }
    setSubmitting(true);
    const res = await onSubmit({ rating, title, body });
    setSubmitting(false);
    if (!res.ok) { setError(res.error || "Something went wrong"); return; }
    // Parent closes / refreshes
  }

  const displayStars = hover || rating;
  const bodyLen = body.length;

  return (
    <form className="rev-form" onSubmit={handleSubmit}>
      <div className="rev-form__row">
        <label className="rev-form__lbl">Your rating</label>
        <div
          className="rev-form__stars"
          role="radiogroup"
          aria-label="Rating"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="rev-form__star"
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              aria-checked={rating === n}
              role="radio"
              title={`${n} star${n === 1 ? "" : "s"}`}
            >
              <Star
                size={26}
                fill={n <= displayStars ? "#f59e0b" : "none"}
                stroke={n <= displayStars ? "#f59e0b" : "#94a3b8"}
                strokeWidth={1.5}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="rev-form__ratelbl">
              {["Not great", "Okay", "Good", "Great", "Excellent"][rating - 1]}
            </span>
          )}
        </div>
      </div>

      <div className="rev-form__row">
        <label className="rev-form__lbl" htmlFor="rev-title">Title <span className="rev-form__opt">(optional)</span></label>
        <input
          id="rev-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum it up in a few words"
          maxLength={120}
          className="rev-form__input"
        />
      </div>

      <div className="rev-form__row">
        <label className="rev-form__lbl" htmlFor="rev-body">Your review</label>
        <textarea
          id="rev-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="How was it? What did you like or wish was better? Would you recommend it?"
          rows={5}
          maxLength={2000}
          required
          className="rev-form__input rev-form__ta"
        />
        <div className="rev-form__meta">
          <small className={bodyLen < 10 ? "rev-form__count rev-form__count--warn" : "rev-form__count"}>
            {bodyLen} / 2000 characters
          </small>
        </div>
      </div>

      {error && <div className="rev-form__err">{error}</div>}

      <div className="rev-form__note">
        {isEdit
          ? "Your update goes live immediately. Our team may still review it."
          : "As a verified buyer, your review goes live immediately. Please follow our review guidelines."}
      </div>

      <div className="rev-form__actions">
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        )}
        <button type="submit" className="btn-shop" disabled={submitting}>
          {submitting ? "Submitting…" : isEdit ? "Update review" : "Post review"}
        </button>
      </div>
    </form>
  );
}