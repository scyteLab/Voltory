import { Link } from "react-router-dom";
import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";
import { bySku } from "../../data/products.js";
import { naira, stockState } from "../../utils/format.js";

export default function AccountWishlist() {
  const { wishlist, toggleWishlist, addToCart } = useStore();
  const items = wishlist.map((sku) => bySku(sku)).filter(Boolean);

  return (
    <div className="wish-list">
      <header className="ord-list__head">
        <h1>My Wishlist</h1>
        <p>
          {items.length === 0
            ? "Save items you love and come back to them anytime."
            : `${items.length} saved item${items.length === 1 ? "" : "s"}.`}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="ord-empty">
          <Heart size={48} strokeWidth={1.1} />
          <h2>Your wishlist is empty</h2>
          <p>Tap the heart on any product to save it here. We'll let you know when prices drop.</p>
          <Link to="/" className="btn-shop">Browse Products</Link>
        </div>
      ) : (
        <ul className="wish-grid">
          {items.map((p) => {
            const st = stockState(p.stock);
            return (
              <li key={p.sku} className="wish-card">
                <Link to={`/product/${p.slug}`} className="wish-card__img">
                  {p.image && <img src={p.image} alt={p.name} />}
                </Link>
                <div className="wish-card__body">
                  <Link to={`/product/${p.slug}`} className="wish-card__name">
                    {p.name}
                  </Link>
                  <span className="wish-card__price">{naira(p.price)}</span>
                  <span className={`pcard__stock pcard__stock--${st}`}>
                    {st === "ok" ? "In Stock" : st === "low" ? `Only ${p.stock} left` : "Out of Stock"}
                  </span>
                  <div className="wish-card__actions">
                    <button
                      className="wish-card__add"
                      onClick={() => { addToCart(p.sku); }}
                      disabled={st === "out"}
                    >
                      <ShoppingCart size={13} /> Add to Cart
                    </button>
                    <button
                      className="wish-card__remove"
                      onClick={() => toggleWishlist(p.sku)}
                      aria-label={`Remove ${p.name} from wishlist`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}