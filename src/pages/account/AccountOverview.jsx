import { Link } from "react-router-dom";
import {
  ChevronRight, Heart, MapPin, Package, ShoppingBag, User,
} from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import { useCustomerOrders } from "../../hooks/useCustomerOrders.js";
import { STATUS_LABEL } from "../../utils/orders.js";
import { naira } from "../../utils/format.js";

export default function AccountOverview() {
  const { customer } = useCustomerAuth();
  const { wishlistCount } = useStore();
  const { orders: myOrders } = useCustomerOrders();
  if (!customer) return null; // AccountLayout redirects; this is belt+braces
  const displayPhone = (customer.phone || "").startsWith("+234")
    ? "0" + customer.phone.slice(4)
    : (customer.phone || "");
  const account = { name: customer.name || "", phone: displayPhone };

  const recent = myOrders.slice(0, 3);
  const lastAddress = myOrders[0]?.address;

  const totalSpent = myOrders.reduce((s, o) => s + (o.totals?.grand || 0), 0);

  return (
    <div className="ovw">
      {/* greeting */}
      <div className="ovw-greet">
        <div>
          <small>Welcome back,</small>
          <h1>{(account.name || "there").split(/\s+/)[0]}</h1>
          <p>Here's what's happening with your account.</p>
        </div>
        <span className="ovw-greet__icon"><User size={28} /></span>
      </div>

      {/* quick stats */}
      <div className="ovw-stats">
        <Link to="/account/orders" className="ovw-stat">
          <span className="ovw-stat__icon"><Package size={20} /></span>
          <div>
            <small>Total Orders</small>
            <b>{myOrders.length}</b>
          </div>
        </Link>
        <div className="ovw-stat">
          <span className="ovw-stat__icon"><ShoppingBag size={20} /></span>
          <div>
            <small>Total Spent</small>
            <b>{naira(totalSpent)}</b>
          </div>
        </div>
        <Link to="/account/wishlist" className="ovw-stat">
          <span className="ovw-stat__icon"><Heart size={20} /></span>
          <div>
            <small>Wishlist Items</small>
            <b>{wishlistCount}</b>
          </div>
        </Link>
      </div>

      {/* recent orders */}
      <div className="ovw-section">
        <div className="ovw-section__head">
          <h2>Recent Orders</h2>
          {myOrders.length > 0 && (
            <Link to="/account/orders">View all <ChevronRight size={14} /></Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="ovw-empty">
            <Package size={32} strokeWidth={1.2} />
            <p>No orders yet.</p>
            <Link to="/" className="btn-shop">Start Shopping</Link>
          </div>
        ) : (
          <ul className="ovw-orders">
            {recent.map((o) => (
              <li key={o.id}>
                <Link to={`/account/orders/${o.id}`}>
                  <div className="ovw-orders__id">
                    <b className="mono">{o.id}</b>
                    <small>{new Date(o.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}</small>
                  </div>
                  <div className="ovw-orders__items">
                    {o.items.slice(0, 3).map((it) => (
                      <span key={it.sku} className="ovw-orders__img">
                        {it.image && <img src={it.image} alt="" />}
                      </span>
                    ))}
                    {o.items.length > 3 && (
                      <span className="ovw-orders__more">+{o.items.length - 3}</span>
                    )}
                  </div>
                  <div className="ovw-orders__total">
                    <b>{naira(o.totals.grand)}</b>
                    <span className={`ovw-status ovw-status--${o.status}`}>
                      {STATUS_LABEL[o.status]}
                    </span>
                  </div>
                  <ChevronRight size={16} className="ovw-orders__chev" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* default address */}
      <div className="ovw-section">
        <div className="ovw-section__head">
          <h2>Saved Address</h2>
          <Link to="/account/addresses">Manage <ChevronRight size={14} /></Link>
        </div>
        {lastAddress ? (
          <div className="ovw-addr">
            <span className="ovw-addr__icon"><MapPin size={18} /></span>
            <div>
              <b>{account.name}</b>
              <p>
                {lastAddress.street}<br />
                {lastAddress.lga}, {lastAddress.state}
                {lastAddress.landmark && <><br /><small>{lastAddress.landmark}</small></>}
              </p>
              <small className="mono">{account.phone}</small>
            </div>
          </div>
        ) : (
          <div className="ovw-empty">
            <MapPin size={32} strokeWidth={1.2} />
            <p>No saved addresses yet.</p>
            <small>Your delivery address is saved automatically with your first order.</small>
          </div>
        )}
      </div>
    </div>
  );
}