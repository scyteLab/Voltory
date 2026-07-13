import { Star } from "lucide-react";

/** ★★★★☆ 4.6 (128) — used on cards, product page, reviews. */
export default function RatingStars({ rating, reviews, size = 12 }) {
  const full = Math.round(rating);
  return (
    <span className="stars" aria-label={`Rated ${rating} out of 5`}>
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
        {rating}{reviews != null && ` (${reviews})`}
      </span>
    </span>
  );
}
