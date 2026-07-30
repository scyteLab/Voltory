import { Link } from "react-router-dom";
import { Info, MapPin, Phone } from "lucide-react";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import { useCustomerOrders } from "../../hooks/useCustomerOrders.js";

/**
 * Saved Addresses \u2014 read-only for now, derived from the addresses
 * the customer has used at checkout across every device. Now that
 * orders come from Supabase, this stays in sync across devices
 * automatically.
 *
 * Deduped by street + LGA. Most recent address marked Default.
 * Add / edit / set-default arrive with the customer_addresses
 * table wiring (later session).
 */
export default function AccountAddresses() {
  const { customer } = useCustomerAuth();
  const { orders: myOrders, loading } = useCustomerOrders();
  if (!customer) return null;
  const displayPhone = (customer.phone || "").startsWith("+234")
    ? "0" + customer.phone.slice(4)
    : (customer.phone || "");
  const account = { name: customer.name || "", phone: displayPhone };

  // Dedupe by street + LGA, keeping the most recent
  const seen = new Map();
  for (const o of myOrders) {
    if (!o.address) continue;
    const key = `${o.address.street}|${o.address.lga}|${o.address.state}`.toLowerCase();
    if (!seen.has(key)) seen.set(key, { ...o.address, lastUsed: o.createdAt });
  }
  const addresses = Array.from(seen.values());

  if (loading) {
    return (
      <div className="addr-list">
        <header className="ord-list__head">
          <h1>Saved Addresses</h1>
          <p>Loading\u2026</p>
        </header>
      </div>
    );
  }

  return (
    <div className="addr-list">
      <header className="ord-list__head">
        <h1>Saved Addresses</h1>
        <p>
          {addresses.length === 0
            ? "Your delivery addresses appear here automatically after your first order."
            : `${addresses.length} address${addresses.length === 1 ? "" : "es"} saved.`}
        </p>
      </header>

      {addresses.length === 0 ? (
        <div className="ord-empty">
          <MapPin size={48} strokeWidth={1.1} />
          <h2>No addresses yet</h2>
          <p>Place your first order and we'll save the delivery address here for next time.</p>
          <Link to="/" className="btn-shop">Browse Products</Link>
        </div>
      ) : (
        <>
          <ul className="addr-cards">
            {addresses.map((a, i) => (
              <li key={`${a.street}-${i}`} className={"addr-card" + (i === 0 ? " addr-card--default" : "")}>
                {i === 0 && <span className="addr-card__default">Default</span>}
                <MapPin size={18} className="addr-card__icon" />
                <div className="addr-card__body">
                  <b>{account.name}</b>
                  <p>
                    {a.street}<br />
                    {a.lga}, {a.state}
                    {a.landmark && <><br /><small>Landmark: {a.landmark}</small></>}
                  </p>
                  <small className="addr-card__phone">
                    <Phone size={11} /> <span className="mono">{account.phone}</span>
                  </small>
                </div>
              </li>
            ))}
          </ul>

          <div className="addr-note">
            <Info size={14} />
            <span>
              Address management (add, edit, set default) arrives with our next platform update.
              For now, addresses are saved automatically from your orders.
            </span>
          </div>
        </>
      )}
    </div>
  );
}