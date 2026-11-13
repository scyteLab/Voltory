import { useRef, useState } from "react";
import { Star } from "lucide-react";
import { RATING_LABELS, REVIEW_ERROR_MESSAGES, REVIEW_LIMITS, validateReviewInput } from "../../lib/reviewRules.js";

/**
 * ReviewForm — write or edit a review.
 *
 * Rating (1–5) is required; title and comment are optional. The star
 * picker is a radio group: Tab focuses it, arrow keys / Home / End
 * change the rating, 1–5 jump straight to a value.
 *
 * The server saves every submit (new or edit) as "pending"; the note
 * under the form says so.
 */
export default function ReviewForm({ existingReview, onSubmit, onCancel }) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hover, setHover]   = useState(0);
  const [title, setTitle]   = useState(existingReview?.title || "");
  const [body, setBody]     = useState(existingReview?.body || "");
  const [error, setError]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const starRefs = useRef([]);

  const isEdit = !!existingReview;
  const shown = hover || rating;
  const bodyLen = body.trim().length;
  const bodyShort = bodyLen > 0 && bodyLen < REVIEW_LIMITS.bodyMin;

  function pick(n, focus = false) {
    setRating(n);
    setError(null);
    if (focus) starRefs.current[n - 1]?.focus();
  }

  function onStarKey(e) {
    const cur = rating || 0;
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, cur + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, cur - 1);
    else if (e.key === "Home") next = 1;
    else if (e.key === "End") next = 5;
    else if (/^[1-5]$/.test(e.key)) next = Number(e.key);
    if (next) {
      e.preventDefault();
      pick(next, true);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const checked = validateReviewInput({ rating, title, body });
    if (!checked.ok) {
      setError(REVIEW_ERROR_MESSAGES[checked.error]);
      if (checked.error === "invalid_rating") starRefs.current[0]?.focus();
      return;
    }
    setSubmitting(true);
    const res = await onSubmit(checked.value);
    setSubmitting(false);
    if (!res.ok) setError(res.error || "Something went wrong. Please try again.");
  }

  return (
    <form className="rev-form" onSubmit={handleSubmit} noValidate>
      <div className="rev-form__row">
        <span className="rev-form__lbl" id="rev-rating-lbl">Your rating <span className="rev-form__req">*</span></span>
        <div
          className="rev-form__stars"
          role="radiogroup"
          aria-labelledby="rev-rating-lbl"
          aria-required="true"
          onMouseLeave={() => setHover(0)}
          onKeyDown={onStarKey}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              ref={(el) => { starRefs.current[n - 1] = el; }}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}: ${RATING_LABELS[n - 1]}`}
              tabIndex={rating ? (rating === n ? 0 : -1) : (n === 1 ? 0 : -1)}
              className="rev-form__star"
              onMouseEnter={() => setHover(n)}
              onClick={() => pick(n)}
            >
              <Star
                size={28}
                fill={n <= shown ? "#f59e0b" : "none"}
                stroke={n <= shown ? "#f59e0b" : "#94a3b8"}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
          ))}
          <span className="rev-form__ratelbl" aria-live="polite">
            {shown ? RATING_LABELS[shown - 1] : "Tap a star to rate"}
          </span>
        </div>
      </div>

      <div className="rev-form__row">
        <label className="rev-form__lbl" htmlFor="rev-title">
          Title <span className="rev-form__opt">(optional)</span>
        </label>
        <input
          id="rev-title"
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(null); }}
          placeholder="Sum it up in a few words"
          maxLength={REVIEW_LIMITS.titleMax}
          className="rev-form__input"
        />
        <div className="rev-form__meta">
          <small className="rev-form__count">{title.length} / {REVIEW_LIMITS.titleMax}</small>
        </div>
      </div>

      <div className="rev-form__row">
        <label className="rev-form__lbl" htmlFor="rev-body">
          Comment <span className="rev-form__opt">(optional)</span>
        </label>
        <textarea
          id="rev-body"
          value={body}
          onChange={(e) => { setBody(e.target.value); setError(null); }}
          placeholder="How was it? What did you like, or wish was better? Would you recommend it?"
          rows={5}
          maxLength={REVIEW_LIMITS.bodyMax}
          aria-describedby="rev-body-count"
          className="rev-form__input rev-form__ta"
        />
        <div className="rev-form__meta">
          <small id="rev-body-count" className={bodyShort ? "rev-form__count rev-form__count--warn" : "rev-form__count"}>
            {bodyShort ? `At least ${REVIEW_LIMITS.bodyMin} characters · ` : ""}
            {body.length} / {REVIEW_LIMITS.bodyMax}
          </small>
        </div>
      </div>

      {error && <div className="rev-form__err" role="alert">{error}</div>}

      <div className="rev-form__note">
        Your review will appear after a quick check by our team.
        {isEdit && existingReview?.status === "approved" && " Your published review is hidden until the update is checked."}
      </div>

      <div className="rev-form__actions">
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        )}
        <button type="submit" className="btn-shop" disabled={submitting}>
          {submitting ? "Submitting…" : isEdit ? "Update review" : "Submit review"}
        </button>
      </div>
    </form>
  );
}
