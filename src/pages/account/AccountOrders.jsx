import { Link } from "react-router-dom";
import { ChevronRight, Package, Pencil, Star } from "lucide-react";
import { useCustomerOrders } from "../../hooks/useCustomerOrders.js";
import { useCustomerReviews } from "../../hooks/useCustomerReviews.js";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { STATUS_LABEL } from "../../utils/orders.js";
import { naira } from "../../utils/format.js";

/**
 * My Orders — lists every order belonging to the signed-in customer.
 *
 * Reads from Supabase via useCustomerOrders (with a localStorage
 * fallback merged in). This means a customer who signs in on a new
 * device sees their order history immediately.
 */
export default function AccountOrders() {
  const { orders, loading } = useCustomerOrders();
  const { reviews } = useCustomerReviews();
  const { bySku } = useCatalog();
  const reviewed = new Set(reviews.map((r) => r.productSku));

  if (loading) {
    return (
      <div className="ord-list">
        <header className="ord-list__head">
          <h1>My Orders</h1>
          <p>Loading your orders…</p>
        </header>
      </div>
    );
  }

  return (
    <div className="ord-list">
      <header className="ord-list__head">
        <h1>My Orders</h1>
        <p>
          {orders.length === 0
            ? "You haven't placed any orders yet."
            : `${orders.length} order${orders.length === 1 ? "" : "s"} placed.`}
        </p>
      </header>

      {orders.length === 0 ? (
        <div className="ord-empty">
          <Package size={48} strokeWidth={1.1} />
          <h2>Nothing here yet</h2>
          <p>Browse our catalogue and place your first order to see it here.</p>
          <Link to="/" className="btn-shop">Start Shopping</Link>
        </div>
      ) : (
        <ul className="ord-rows">
          {orders.map((o) => {
            const itemCount = (o.items || []).reduce((s, i) => s + i.qty, 0);
            return (
              <li key={o.id}>
                <Link to={`/account/orders/${o.id}`} className="ord-row">
                  <div className="ord-row__main">
                    <div className="ord-row__top">
                      <b className="mono">{o.id}</b>
                      <span className={`ovw-status ovw-status--${o.status}`}>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </div>
                    <p className="ord-row__date">
                      Placed on {new Date(o.createdAt).toLocaleDateString("en-NG", {
                        dateStyle: "long",
                      })}
                    </p>
                    <div className="ord-row__items">
                      {(o.items || []).slice(0, 4).map((it) => (
                        <span key={it.sku} className="ord-row__img">
                          {it.image && <img src={it.image} alt="" />}
                        </span>
                      ))}
                      {(o.items || []).length > 4 && (
                        <span className="ord-row__more">+{o.items.length - 4}</span>
                      )}
                      <span className="ord-row__count">
                        {itemCount} item{itemCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                  <div className="ord-row__right">
                    <b>{naira(o.totals.grand)}</b>
                    <span className="ord-row__view">
                      View Details <ChevronRight size={14} />
                    </span>
                  </div>
                </Link>

                {/* Delivered: one "Rate & review" per item (form opens on the product page). */}
                {(() => {
                  if (o.status !== "delivered") return null;
                  // Only items still in the catalogue (they need a product page).
                  const rateable = (o.items || [])
                    .map((it) => ({ ...it, slug: bySku(it.sku)?.slug }))
                    .filter((it) => it.slug);
                  if (rateable.length === 0) return null;
                  return (
                    <ul className="ord-rate" aria-label={`Review the items in order ${o.id}`}>
                      {rateable.map((it) => {
                        const done = reviewed.has(it.sku);
                        return (
                          <li key={it.sku} className="ord-rate__item">
                            <span className="ord-rate__name">{it.name || it.sku}</span>
                            <Link to={`/product/${it.slug}#write-review`} className={done ? "btn-ghost" : "btn-shop ord-rate__btn"}>
                              {done ? <><Pencil size={12} /> Your review</> : <><Star size={12} /> Rate &amp; review</>}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}