import { Link } from "react-router-dom";
import { ChevronRight, Package } from "lucide-react";
import { useCustomerOrders } from "../../hooks/useCustomerOrders.js";
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}