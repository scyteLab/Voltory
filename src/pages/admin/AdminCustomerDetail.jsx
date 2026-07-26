import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Award, Banknote, Copy, ExternalLink, MapPin,
  MessageCircle, Phone, RefreshCw, ShoppingCart, Sparkles, User,
} from "lucide-react";
import { fetchCustomerWithOrders } from "../../hooks/useCustomers.js";
import { ORDER_STATUSES, PAYMENT_LABELS } from "../../config/orderStatus.js";

function naira(n) { return "\u20A6" + Number(n || 0).toLocaleString("en-NG"); }
function fmtDateLong(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("en-NG", {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDate(iso) {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Normalise a Nigerian local-format phone (0803...) into +234
 * format for tel: and wa.me links. If it's already in international
 * format we leave it alone.
 */
function toIntlPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("234")) return "+" + digits;
  if (digits.startsWith("0"))   return "+234" + digits.slice(1);
  return "+" + digits;
}

const TAG_META = {
  vip:      { label: "VIP",       cls: "adm-chip--info", icon: Award,    tone: "info" },
  repeat:   { label: "Repeat",    cls: "adm-chip--ok",   icon: Sparkles, tone: "ok" },
  new:      { label: "New",       cls: "adm-chip--warn", icon: User,     tone: "warn" },
  standard: { label: "Customer",  cls: "adm-chip--info", icon: User,     tone: "info" },
};

export default function AdminCustomerDetail() {
  const { phone: rawPhone } = useParams();
  const phone = decodeURIComponent(rawPhone || "");
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerWithOrders(phone);
      if (!data) {
        setError("Customer not found.");
        setCustomer(null);
      } else {
        setCustomer(data);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => { load(); }, [load]);

  async function copyPhone() {
    try { await navigator.clipboard.writeText(phone); } catch { /* noop */ }
  }

  if (loading) {
    return (
      <div className="adm-page">
        <BackLink />
        <div className="adm-empty adm-empty--loading">Loading customer…</div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="adm-page">
        <BackLink />
        <div className="adm-empty adm-empty--err">
          <AlertTriangle size={32} />
          <b>{error || "Customer not found."}</b>
          <button className="adm-btn adm-btn--secondary" onClick={load}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const tag = TAG_META[customer.tag] || TAG_META.standard;
  const TagIcon = tag.icon;
  const intlPhone = toIntlPhone(customer.phone);
  const waPhone = intlPhone.replace(/^\+/, "");

  // Extract unique addresses used across orders
  const addressMap = new Map();
  for (const o of customer.orders) {
    if (o.address && Object.keys(o.address).length) {
      const key = JSON.stringify(o.address);
      if (!addressMap.has(key)) addressMap.set(key, o.address);
    }
  }
  const addresses = Array.from(addressMap.values());

  return (
    <div className="adm-page adm-orderdetail">
      <BackLink />

      <header className="adm-orderdetail__head">
        <div>
          <div className="adm-orderdetail__title-row">
            <span className="adm-cust__avatar-lg">{(customer.name || "?")[0].toUpperCase()}</span>
            <div>
              <h1>{customer.name || "Unnamed customer"}</h1>
              <p>Customer since {fmtDateLong(customer.first_order_at)}</p>
            </div>
            <span className={"adm-chip " + tag.cls}>
              <TagIcon size={11} /> {tag.label}
            </span>
          </div>
        </div>
        <button className="adm-btn adm-btn--secondary" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </button>
      </header>

      <div className="adm-orderdetail__split">
        {/* LEFT: order history */}
        <section className="adm-orderdetail__main">
          <div className="adm-widget">
            <header>
              <div>
                <b>Lifetime Stats</b>
                <small>Since first order on {fmtDate(customer.first_order_at)}</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: "16px 22px" }}>
              <div className="adm-cust__stats">
                <div>
                  <span className="adm-cust__stat-label">Total Orders</span>
                  <span className="adm-cust__stat-value">
                    <ShoppingCart size={14} /> {customer.order_count}
                  </span>
                  <small>{customer.active_orders} active</small>
                </div>
                <div>
                  <span className="adm-cust__stat-label">Total Spent</span>
                  <span className="adm-cust__stat-value">
                    <Banknote size={14} /> {naira(customer.total_spent)}
                  </span>
                  <small>Excludes cancellations</small>
                </div>
                <div>
                  <span className="adm-cust__stat-label">Last Order</span>
                  <span className="adm-cust__stat-value">{fmtDate(customer.last_order_at)}</span>
                  <small>{fmtDateLong(customer.last_order_at)}</small>
                </div>
                <div>
                  <span className="adm-cust__stat-label">Avg. Order Value</span>
                  <span className="adm-cust__stat-value">
                    {naira(customer.active_orders > 0
                      ? Math.round(customer.total_spent / customer.active_orders)
                      : 0)}
                  </span>
                  <small>Per active order</small>
                </div>
              </div>
            </div>
          </div>

          <div className="adm-widget">
            <header>
              <div>
                <b>Order History</b>
                <small>{customer.orders.length} order{customer.orders.length === 1 ? "" : "s"} total</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: 0 }}>
              {customer.orders.length === 0 ? (
                <p className="adm-lineitems__empty">No orders yet.</p>
              ) : (
                <ul className="adm-orderhistory">
                  {customer.orders.map((o) => {
                    const st = ORDER_STATUSES[o.status] || { label: o.status, chip: "adm-chip--info" };
                    return (
                      <li key={o.id}>
                        <Link to={`/admin/orders/${o.id}`}>
                          <div className="adm-orderhistory__id">
                            <b className="adm-mono">{o.id}</b>
                            <small>{PAYMENT_LABELS[o.payment_method] || o.payment_method}</small>
                          </div>
                          <div className="adm-orderhistory__date">
                            {fmtDate(o.created_at)}
                          </div>
                          <div className="adm-orderhistory__total">
                            {naira(o.total)}
                          </div>
                          <span className={"adm-chip " + st.chip}>{st.label}</span>
                          <ExternalLink size={13} className="adm-orderhistory__chev" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT: contact + addresses + quick actions */}
        <aside className="adm-orderdetail__side">
          <div className="adm-widget">
            <header><div><b>Contact</b></div></header>
            <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
              <ul className="adm-kvlist">
                <li>
                  <Phone size={13} />
                  <span className="adm-mono">{customer.phone}</span>
                  <button
                    className="adm-icon-btn adm-icon-btn--sm"
                    onClick={copyPhone}
                    aria-label="Copy phone number"
                    title="Copy"
                    style={{ marginLeft: "auto" }}
                  >
                    <Copy size={12} />
                  </button>
                </li>
                {customer.email && (
                  <li>
                    <span aria-hidden="true">@</span>
                    <span style={{ wordBreak: "break-all" }}>{customer.email}</span>
                  </li>
                )}
              </ul>

              <div className="adm-cust__actions">
                <a
                  href={`https://wa.me/${waPhone}`}
                  target="_blank" rel="noreferrer"
                  className="adm-btn adm-btn--primary adm-btn--wa"
                >
                  <MessageCircle size={13} /> WhatsApp
                </a>
                <a href={`tel:${intlPhone}`} className="adm-btn adm-btn--secondary">
                  <Phone size={13} /> Call
                </a>
              </div>
            </div>
          </div>

          <div className="adm-widget">
            <header>
              <div>
                <b>Addresses Used</b>
                <small>{addresses.length} on file</small>
              </div>
            </header>
            <div className="adm-widget__body" style={{ padding: "12px 20px 16px" }}>
              {addresses.length === 0 ? (
                <p className="adm-kvlist__empty">No addresses recorded.</p>
              ) : (
                <ul className="adm-cust__addresses">
                  {addresses.map((a, i) => (
                    <li key={i}>
                      <MapPin size={13} />
                      <div>
                        {a.street && <b>{a.street}</b>}
                        <small>
                          {[a.area, a.state].filter(Boolean).join(" \u00B7 ") || "\u2014"}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <div style={{ marginBottom: 14 }}>
      <Link to="/admin/customers" className="adm-orderdetail__back">
        <ArrowLeft size={13} /> Back to customers
      </Link>
    </div>
  );
}