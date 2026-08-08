import { Star } from "lucide-react";

/**
 * RatingStars \u2014 shared across product cards, product page hero,
 * category listings.
 *
 * Honest empty state: when there are no approved reviews yet
 * (reviews === 0 or rating is null/0), we don't render empty
 * stars \u2014 that reads like "0 out of 5 stars" and lies. Instead
 * we show a subtle "No reviews yet" label so nothing pretends
 * there's a rating.
 *
 * `variant` controls how compact the empty label is:
 *   \u00B7 "default" \u2014 "No reviews yet" text (product page)
 *   \u00B7 "compact" \u2014 empty span, nothing shown (tight card tiles)
 */
export default function RatingStars({ rating, reviews, size = 12, variant = "default" }) {
  const numRating  = Number(rating) || 0;
  const numReviews = Number(reviews) || 0;
  const hasReviews = numReviews > 0 && numRating > 0;

  if (!hasReviews) {
    if (variant === "compact") {
      // Reserve no space in dense product-card grids so cards
      // stay aligned. If you want to show something instead,
      // pass variant="default".
      return <span className="stars stars--empty" aria-label="No reviews yet" />;
    }
    return (
      <span className="stars stars--empty" aria-label="No reviews yet">
        <span className="stars__meta stars__meta--empty">No reviews yet</span>
      </span>
    );
  }

  const full = Math.round(numRating);
  return (
    <span className="stars" aria-label={`Rated ${numRating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= full ? "stars__on" : "stars__off"}
          fill="currentColor"
          strokeWidth={0}
        />
      ))}
      <span className="stars__meta">
        {numRating.toFixed(1)} ({numReviews})
      </span>
    </span>
  );
}