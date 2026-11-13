import { BadgeCheck, Star } from "lucide-react";

/**
 * ReviewCard — one approved review on the product page. Author is
 * already shortened to "First L." by the database function.
 */
export default function ReviewCard({ review }) {
  const dateStr = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })
    : "";

  return (
    <article className="rev-card">
      <header className="rev-card__head">
        <div className="rev-card__stars" role="img" aria-label={`${review.rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={14}
              fill={n <= review.rating ? "#f59e0b" : "none"}
              stroke={n <= review.rating ? "#f59e0b" : "#cbd5e1"}
              aria-hidden="true"
            />
          ))}
        </div>
        {review.title && <b className="rev-card__title">{review.title}</b>}
      </header>

      {review.body && <p className="rev-card__body">{review.body}</p>}

      <footer className="rev-card__foot">
        <span className="rev-card__author">
          <b>{review.author}</b>
          {review.verified && (
            <span className="rev-card__verified">
              <BadgeCheck size={12} aria-hidden="true" /> Verified Purchase
            </span>
          )}
        </span>
        {dateStr && <time className="rev-card__date" dateTime={review.createdAt}>{dateStr}</time>}
      </footer>
    </article>
  );
}
