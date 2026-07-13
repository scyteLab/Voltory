import { useEffect, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { naira } from "../../utils/format.js";
import { useStore } from "../../context/StoreContext.jsx";

/**
 * Sticky bottom add-to-cart bar — visible on mobile after the main
 * buy box scrolls out of view. Tracks an anchor element passed by
 * the product page so we know when to slide it in.
 *
 * Hidden on desktop via CSS.
 */
export default function AddToCartBar({ product, anchorRef, qty }) {
  const { addToCart } = useStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!anchorRef?.current) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    io.observe(anchorRef.current);
    return () => io.disconnect();
  }, [anchorRef]);

  if (!product) return null;

  return (
    <div className={"atcbar" + (visible ? " atcbar--on" : "")} aria-hidden={!visible}>
      <div className="atcbar__inner">
        <span className="atcbar__img">
          {product.image && <img src={product.image} alt="" />}
        </span>
        <div className="atcbar__info">
          <p className="atcbar__name">{product.name}</p>
          <p className="atcbar__price">{naira(product.price * (qty || 1))}</p>
        </div>
        <button
          className="atcbar__btn"
          onClick={() => addToCart(product.sku, qty || 1)}
          disabled={product.stock === 0}
        >
          <ShoppingCart size={15} /> Add to Cart
        </button>
      </div>
    </div>
  );
}