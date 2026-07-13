import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  ChevronRight, Home as HomeIcon, Minus, Plus, ShoppingBag, Tag,
  Trash2, Truck, X,
} from "lucide-react";
import { useStore } from "../context/StoreContext.jsx";
import { bySku, PRODUCTS } from "../data/products.js";
import { naira } from "../utils/format.js";
import { SITE } from "../config/site.js";
import ProductCard from "../components/product/ProductCard.jsx";

export default function Cart() {
  const { cart, setQty, removeFromCart, totals, coupon, setCoupon, count } = useStore();
  const navigate = useNavigate();

  if (cart.length === 0) return <EmptyCart />;

  const freeDeliveryGap = Math.max(0, SITE.freeDeliveryOver - totals.subtotal);
  const freeDeliveryProgress = Math.min(100, (totals.subtotal / SITE.freeDeliveryOver) * 100);

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

          {/* Free-delivery progress */}
          {freeDeliveryGap > 0 ? (
            <div className="cart-fd cart-fd--gap">
              <Truck size={16} />
              <span>
                Add <b>{naira(freeDeliveryGap)}</b> more for FREE delivery
              </span>
              <div className="cart-fd__bar">
                <div className="cart-fd__fill" style={{ width: `${freeDeliveryProgress}%` }} />
              </div>
            </div>
          ) : (
            <div className="cart-fd cart-fd--won">
              <Truck size={16} />
              <span>🎉 You qualify for <b>FREE delivery</b></span>
            </div>
          )}

          {/* Line items */}
          <ul className="cart-lines">
            {cart.map((item) => {
              const p = bySku(item.sku);
              if (!p) return null;
              return (
                <li className="cart-line" key={item.sku}>
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

          <CouponInput coupon={coupon} setCoupon={setCoupon} />

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
            <div>
              <dt>Delivery Fee</dt>
              <dd>{totals.deliveryFee === 0 ? "FREE" : naira(totals.deliveryFee)}</dd>
            </div>
            <div className="cart-totals__grand">
              <dt>Total</dt>
              <dd>{naira(totals.grand)}</dd>
            </div>
          </dl>

          <button className="cart-checkout" onClick={() => navigate("/checkout")}>
            Proceed to Checkout <ChevronRight size={16} />
          </button>

          <p className="cart-secure">
            🔒 Secure checkout · Pay on delivery available
          </p>
        </aside>
      </div>

      {/* Cross-sell rail */}
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2>You Might Also Like</h2>
        <Link to="/">View more <ChevronRight size={14} style={{ verticalAlign: "middle" }} /></Link>
      </div>
      <section className="pgrid">
        {PRODUCTS.filter((p) => !cart.find((i) => i.sku === p.sku)).slice(0, 5).map((p) => (
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
        {PRODUCTS.slice(0, 5).map((p) => (
          <ProductCard key={p.sku} product={p} />
        ))}
      </section>
    </main>
  );
}