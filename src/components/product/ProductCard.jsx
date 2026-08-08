import { Link, useNavigate } from "react-router-dom";
import { Heart, Repeat, ShoppingCart } from "lucide-react";
import { naira, discountPct, stockState } from "../../utils/format.js";
import { addRecentlyViewed } from "../../utils/recentlyViewed.js";
import { useStore } from "../../context/StoreContext.jsx";
import { MAX_COMPARE } from "../../utils/comparison.js";
import Icon from "../ui/Icon.jsx";
import RatingStars from "./RatingStars.jsx";

const BADGES = {
  deal: (p) => ({ cls: "pcard__badge--deal", label: `-${discountPct(p.price, p.was)}%` }),
  best: () => ({ cls: "pcard__badge--best", label: "Best Seller" }),
  new: () => ({ cls: "pcard__badge--new", label: "New" }),
};

export default function ProductCard({ product }) {
  const {
    addToCart, toggleWishlist, isInWishlist,
    toggleCompare, isInComparison,
  } = useStore();
  const navigate = useNavigate();
  const p = product;
  const badge = p.badge && BADGES[p.badge] ? BADGES[p.badge](p) : null;
  const st = stockState(p.stock);
  const wished = isInWishlist(p.sku);
  const compared = isInComparison(p.sku);
  const recordView = () => addRecentlyViewed(p.sku);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (st !== "out") addToCart(p.sku);
  };

  const handleWish = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(p.sku);
  };

  const handleCompare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleCompare(p.sku);
    if (result.full) {
      // Cap of 4 hit \u2014 nudge user to the Compare page to remove an item.
      alert(`You can compare up to ${MAX_COMPARE} products at a time. Remove one from /compare to add this.`);
      navigate("/compare");
    }
  };

  return (
    <article className="pcard">
      {badge && <span className={`pcard__badge ${badge.cls}`}>{badge.label}</span>}

      {/* corner action stack \u2014 wishlist heart + compare toggle */}
      <span className="pcard__actions-corner">
        <button
          className={"pcard__wish" + (wished ? " pcard__wish--on" : "")}
          onClick={handleWish}
          aria-label={wished ? `Remove ${p.name} from wishlist` : `Add ${p.name} to wishlist`}
          aria-pressed={wished}
          title={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={15} fill={wished ? "currentColor" : "none"} />
        </button>
        <button
          className={"pcard__compare" + (compared ? " pcard__compare--on" : "")}
          onClick={handleCompare}
          aria-label={compared ? `Remove ${p.name} from comparison` : `Add ${p.name} to comparison`}
          aria-pressed={compared}
          title={compared ? "Remove from comparison" : "Add to comparison"}
        >
          <Repeat size={15} />
        </button>
      </span>

      <Link to={`/product/${p.slug}`} className="pcard__img" aria-label={p.name} onClick={recordView}>
        {p.image ? (
          <img src={p.image} alt={p.name} loading="lazy" />
        ) : (
          <Icon name={p.icon} size={52} strokeWidth={1.2} />
        )}
      </Link>
      <Link to={`/product/${p.slug}`} className="pcard__name" onClick={recordView}>{p.name}</Link>
      <RatingStars rating={p.rating} reviews={p.reviews} variant="compact" />
      <span className="pcard__price">
        {naira(p.price)}
        {p.was && <s>{naira(p.was)}</s>}
      </span>
      <span className={`pcard__stock pcard__stock--${st}`}>
        {st === "ok" ? "In Stock" : st === "low" ? `Only ${p.stock} left` : "Out of Stock"}
      </span>
      <span className="pcard__actions">
        <button
          className="pcard__add"
          onClick={handleAdd}
          disabled={st === "out"}
          aria-label={`Add ${p.name} to cart`}
        >
          <ShoppingCart size={13} /> Add to Cart
        </button>
      </span>
    </article>
  );
}