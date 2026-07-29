import { Link } from "react-router-dom";
import { Info, MapPin, Phone } from "lucide-react";
import { useStore, normalisePhone } from "../../context/StoreContext.jsx";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import { listOrders } from "../../utils/orders.js";

/**
 * Saved Addresses \u2014 read-only for now, extracted from the addresses
 * the customer has used at checkout. Deduped by street + LGA. Most
 * recent address marked Default. Add/Edit forms require backend
 * persistence and land with the API phase.
 */
export default function AccountAddresses() {
  const { customer } = useCustomerAuth();
  if (!customer) return null;
  const account = { name: customer.name || "", phone: customer.phone || "" };
  const myOrders = listOrders().filter(
    (o) => normalisePhone(o.contact?.phone) === normalisePhone(account.phone)
  );

  // Dedupe by street + LGA, keeping the most recent
  const seen = new Map();
  for (const o of myOrders) {
    if (!o.address) continue;
    const key = `${o.address.street}|${o.address.lga}|${o.address.state}`.toLowerCase();
    if (!seen.has(key)) seen.set(key, { ...o.address, lastUsed: o.createdAt });
  }
  const addresses = Array.from(seen.values());

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