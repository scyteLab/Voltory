import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { naira } from "../../utils/format.js";

/**
 * Cart success toast. Slides in from the bottom-right after every
 * addToCart call, shows what was added plus the running cart total,
 * and offers two actions: View Cart or keep shopping (dismiss).
 *
 * Mounted once in App.jsx — never imported by individual pages.
 */
export default function Toast() {
  const { toast, dismissToast, totals, count } = useStore();
  const { bySku } = useCatalog();
  if (!toast) return null;

  const product = bySku(toast.sku);
  if (!product) return null;

  return (
    <div
      className="toast"
      role="status"
      aria-live="polite"
      // re-mount on every new add so the slide animation replays
      key={toast.ts}
    >
      <button className="toast__x" onClick={dismissToast} aria-label="Dismiss">
        <X size={15} />
      </button>
      <div className="toast__head">
        <span className="toast__check"><Check size={15} /></span>
        Added to cart
      </div>
      <div className="toast__body">
        <span className="toast__img">
          {product.image && <img src={product.image} alt="" />}
        </span>
        <div className="toast__info">
          <p className="toast__name">{product.name}</p>
          <p className="toast__qty">
            Qty {toast.qty} · {naira(product.price * toast.qty)}
          </p>
        </div>
      </div>
      <div className="toast__totals">
        <span>Cart total · {count} item{count === 1 ? "" : "s"}</span>
        <b>{naira(totals.subtotal)}</b>
      </div>
      <div className="toast__actions">
        <button className="toast__continue" onClick={dismissToast}>
          Continue Shopping
        </button>
        <Link to="/cart" className="toast__view" onClick={dismissToast}>
          View Cart
        </Link>
      </div>
    </div>
  );
}