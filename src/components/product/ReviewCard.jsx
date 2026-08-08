import { BadgeCheck, Star } from "lucide-react";

/**
 * ReviewCard \u2014 one approved review on the product page.
 * Verified-buyer badge if the review was linked to an order.
 */
export default function ReviewCard({ review }) {
  const dateStr = review.createdAt
    ? new Date(review.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })
    : "";

  return (
    <article className="rev-card">
      <header className="rev-card__head">
        <div className="rev-card__stars" aria-label={`${review.rating} out of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              size={14}
              fill={n <= review.rating ? "#f59e0b" : "none"}
              stroke={n <= review.rating ? "#f59e0b" : "#cbd5e1"}
            />
          ))}
        </div>
        {review.title && <b className="rev-card__title">{review.title}</b>}
      </header>

      <p className="rev-card__body">{review.body}</p>

      <footer className="rev-card__foot">
        <span className="rev-card__author">
          <b>{review.authorName}</b>
          {review.verifiedBuyer && (
            <span className="rev-card__verified" title="Verified buyer">
              <BadgeCheck size={12} /> Verified buyer
            </span>
          )}
        </span>
        <span className="rev-card__date">{dateStr}</span>
      </footer>
    </article>
  );
}