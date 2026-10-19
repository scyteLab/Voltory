import { Link, useNavigate } from "react-router-dom";
import { Fragment, useState } from "react";
import {
  ChevronRight, Gift, Home as HomeIcon, MessageCircle, Minus, Plus,
  ShoppingBag, Tag, Trash2, X,
} from "lucide-react";
import { useStore } from "../context/StoreContext.jsx";
import { useCatalog } from "../context/CatalogContext.jsx";
import { naira } from "../utils/format.js";
import { SITE } from "../config/site.js";
import ProductCard from "../components/product/ProductCard.jsx";
import SendToWhatsappModal from "../components/cart/SendToWhatsappModal.jsx";

export default function Cart() {
  const { cart, setQty, removeFromCart, totals, count } = useStore();
  const { products, bySku } = useCatalog();
  const [waModalOpen, setWaModalOpen] = useState(false);
  const navigate = useNavigate();

  if (cart.length === 0) return <EmptyCart />;

  // freeDeliveryGap and freeDeliveryProgress removed 2026-10-19
  // along with the free-delivery progress bar — pending CGCL policy.

  /* Split cart into paid products and gift lines for rendering.
     We render paid product first, then its associated gift (if any)
     right beneath it, so customers see the relationship visually. */
  const paidLines = cart.filter((i) => !i.isGift);
  const giftLines = cart.filter((i) => i.isGift);
  const giftBySku = new Map(giftLines.map((g) => [g.giftFor, g]));

  return (
    <main className="wrap">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Shopping Cart</span>
      </nav>

      <div className="cart-page">
        <section className="cart-items">
          <div className="cart-items__head">
            <h1>
              <ShoppingBag size={20} /> Your Cart
              <span className="cart-items__count">
                {count} item{count === 1 ? "" : "s"}
              </span>
            </h1>
          </div>

          {/* Free-delivery progress bar removed 2026-10-19.
              Delivery policy pending CGCL decision; no delivery claims
              shown until finalised. */}

          {/* Line items */}
          <ul className="cart-lines">
            {paidLines.map((item) => {
              const p = bySku(item.sku);
              if (!p) return null;
              const gift = giftBySku.get(item.sku);
              return (
                <Fragment key={item.sku}>
                  {/* Paid product line */}
                  <li className="cart-line">
                    <Link to={`/product/${p.slug}`} className="cart-line__img">
                      {p.image && <img src={p.image} alt={p.name} />}
                    </Link>
                    <div className="cart-line__info">
                      <Link to={`/product/${p.slug}`} className="cart-line__name">
                        {p.name}
                      </Link>
                      <p className="cart-line__meta">
                        SKU <span className="mono">{p.sku}</span>
                      </p>
                      {p.stock > 0 && p.stock <= 10 && (
                        <p className="cart-line__stock">Only {p.stock} left in stock</p>
                      )}
                      <button
                        className="cart-line__remove"
                        onClick={() => removeFromCart(item.sku)}
                        aria-label={`Remove ${p.name} from cart`}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                    <div className="cart-line__qty">
                      <button onClick={() => setQty(item.sku, item.qty - 1)} aria-label="Decrease">
                        <Minus size={13} />
                      </button>
                      <span>{item.qty}</span>
                      <button onClick={() => setQty(item.sku, item.qty + 1)} aria-label="Increase">
                        <Plus size={13} />
                      </button>
                    </div>
                    <div className="cart-line__price">
                      <b>{naira(p.price * item.qty)}</b>
                      {item.qty > 1 && <small>{naira(p.price)} each</small>}
                    </div>
                  </li>

                  {/* Associated gift line (if any) — rendered directly
                      beneath its parent product so customers see the
                      pairing at a glance. */}
                  {gift && (
                    <li className="cart-line cart-gift">
                      <div className="cart-line__img">
                        {gift.giftImage ? (
                          <img src={gift.giftImage} alt="Gift" />
                        ) : (
                          <div className="cart-line__img-placeholder">
                            <Gift size={20} />
                          </div>
                        )}
                      </div>
                      <div className="cart-line__info">
                        <div className="cart-line__name">
                          <span className="cart-gift__label">
                            <Gift size={11} /> FREE GIFT
                          </span>
                          <div>{gift.giftDescription}</div>
                        </div>
                        <p className="cart-gift__note">
                          With your {p.name}
                        </p>
                      </div>
                      <div className="cart-line__qty">
                        <span title="Gift qty is managed automatically">{gift.qty}</span>
                      </div>
                      <div className="cart-line__price">
                        <b>FREE</b>
                      </div>
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ul>

          <Link to="/" className="cart-continue">
            ← Continue Shopping
          </Link>
        </section>

        {/* Order summary sidebar */}
        <aside className="cart-summary">
          <h2>Order Summary</h2>

          {/* Coupon input UI removed 2026-10-19.
              Automatic 10% welcome discount was removed in Phase 2; this input let
              customers manually re-enable it by typing WELCOME10. Removed entirely
              until Phase 3 ships the proper GM-approved coupon system. */}

          <dl className="cart-totals">
            <div>
              <dt>Subtotal ({count} item{count === 1 ? "" : "s"})</dt>
              <dd>{naira(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="cart-totals__discount">
                <dt>Discount ({SITE.welcomeCoupon.percent}%)</dt>
                <dd>−{naira(totals.discount)}</dd>
              </div>
            )}
            {giftLines.length > 0 && (
              <div className="cart-totals__gifts">
                <dt><Gift size={12} /> Free gift{giftLines.length === 1 ? "" : "s"}</dt>
                <dd>FREE</dd>
              </div>
            )}
            {/* Delivery row hidden pending CGCL policy decision (2026-10-19).
                Fee calculation preserved in totals; display suppressed. */}
            <div className="cart-totals__grand">
              <dt>Total</dt>
              <dd>{naira(totals.grand)}</dd>
            </div>
          </dl>

          <button className="cart-checkout" onClick={() => navigate("/checkout")}>
            Proceed to Checkout <ChevronRight size={16} />
          </button>

          <div className="cart-orsep"><span>or</span></div>

          <button
            type="button"
            className="cart-wa"
            onClick={() => setWaModalOpen(true)}
          >
            <MessageCircle size={15} /> Send Cart to WhatsApp
          </button>

          <p className="cart-secure">
            🔒 Secure checkout · Pay on delivery available
          </p>
        </aside>
      </div>

      {waModalOpen && (
        <SendToWhatsappModal onClose={() => setWaModalOpen(false)} />
      )}

      {/* Cross-sell rail — excludes items already in cart AND gifts */}
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>You Might Also Like</h2>
        <Link to="/">View more <ChevronRight size={14} style={{ verticalAlign: "middle" }} /></Link>
      </div>
      <section className="pgrid">
        {products.filter((p) => !cart.find((i) => i.sku === p.sku)).slice(0, 5).map((p) => (
          <ProductCard key={p.sku} product={p} />
        ))}
      </section>
    </main>
  );
}

function CouponInput({ coupon, setCoupon }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const validCode = SITE.welcomeCoupon.code;

  function apply() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (trimmed === validCode) {
      setCoupon(trimmed);
      setCode("");
      setError("");
    } else {
      setError("Invalid coupon code");
    }
  }

  if (coupon) {
    return (
      <div className="cart-coupon cart-coupon--applied">
        <Tag size={15} />
        <span>Coupon <b className="mono">{coupon}</b> applied — {SITE.welcomeCoupon.percent}% off</span>
        <button className="cart-coupon__remove" onClick={() => setCoupon("")} aria-label="Remove coupon">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="cart-coupon cart-coupon--input">
      <Tag size={15} />
      <div className="cart-coupon__form">
        <input
          type="text"
          value={code}
          onChange={(e) => { setCode(e.target.value); setError(""); }}
          placeholder="Enter coupon code"
          onKeyDown={(e) => e.key === "Enter" && apply()}
        />
        <button onClick={apply}>Apply</button>
      </div>
      {error && <span className="cart-coupon__err">{error}</span>}
    </div>
  );
}

function EmptyCart() {
  const { products } = useCatalog();
  return (
    <main className="wrap">
      <div className="cart-empty">
        <span className="cart-empty__icon"><ShoppingBag size={56} strokeWidth={1.2} /></span>
        <h1>Your cart is empty</h1>
        <p>Looks like you haven't added anything yet. Let's fix that.</p>
        <Link to="/" className="cart-empty__cta">
          Start Shopping <ChevronRight size={16} />
        </Link>
      </div>

      <div className="section-head">
        <h2>Popular Right Now</h2>
      </div>
      <section className="pgrid">
        {products.slice(0, 5).map((p) => (
          <ProductCard key={p.sku} product={p} />
        ))}
      </section>
    </main>
  );
}