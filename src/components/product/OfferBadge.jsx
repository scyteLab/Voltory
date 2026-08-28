import { useEffect, useState } from "react";
import { Clock, Gift } from "lucide-react";

/**
 * OfferBadge — customer-facing display of a promotional offer.
 *
 * Used on:
 *   · Product detail page (large variant with image + description)
 *   · Product card in Deals page (compact variant, badge only)
 *
 * Props:
 *   offer:   the offer object from getOfferBySku()
 *   variant: "large" (default) | "compact"
 *
 * Real behavior:
 *   · Live countdown, updates every 60 seconds
 *   · Shows "Expired" if past ends_at (though getOfferBySku should filter these out)
 *   · Gift image rendered only if URL is present
 */
export default function OfferBadge({ offer, variant = "large" }) {
  const [timeLeft, setTimeLeft] = useState(() => computeTimeLeft(offer.ends_at));

  useEffect(() => {
    /* Update countdown every 60 seconds. No need for per-second
       updates — offers run for days, not minutes. */
    const iv = setInterval(() => {
      setTimeLeft(computeTimeLeft(offer.ends_at));
    }, 60_000);
    return () => clearInterval(iv);
  }, [offer.ends_at]);

  if (variant === "compact") {
    return (
      <div className="offer-badge offer-badge--compact">
        <Gift size={11} />
        <span>FREE GIFT</span>
      </div>
    );
  }

  return (
    <div className="offer-badge offer-badge--large">
      <div className="offer-badge__head">
        <span className="offer-badge__pill">
          <Gift size={12} /> PROMOTIONAL OFFER
        </span>
        {timeLeft.expired ? (
          <span className="offer-badge__timer offer-badge__timer--expired">
            <Clock size={11} /> Ended
          </span>
        ) : (
          <span className="offer-badge__timer">
            <Clock size={11} /> Ends in {formatTimeLeft(timeLeft)}
          </span>
        )}
      </div>

      <h3 className="offer-badge__title">{offer.title}</h3>

      <div className="offer-badge__gift">
        {offer.gift_image && (
          <img
            src={offer.gift_image}
            alt="Gift"
            className="offer-badge__gift-img"
            loading="lazy"
          />
        )}
        <div className="offer-badge__gift-text">
          <b>You'll receive:</b>
          <p>{offer.gift_description}</p>
          {offer.multiply_by_qty && (
            <small>
              ✓ Gift qty multiplies with product qty
            </small>
          )}
        </div>
      </div>
    </div>
  );
}

function computeTimeLeft(endsAt) {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return { expired: true };

  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  return { expired: false, days, hours, minutes };
}

function formatTimeLeft(t) {
  if (t.days > 1)  return `${t.days} days`;
  if (t.days === 1) return `1 day ${t.hours}h`;
  if (t.hours > 0) return `${t.hours}h ${t.minutes}m`;
  return `${t.minutes}m`;
}