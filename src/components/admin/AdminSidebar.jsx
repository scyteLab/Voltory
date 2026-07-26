import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Boxes, ChevronDown, LayoutDashboard, LifeBuoy, Megaphone,
  Package, Settings as SettingsIcon, ShieldCheck, ShoppingCart,
  Star, Tags, Users,
} from "lucide-react";
import Logo from "../layout/Logo.jsx";
import { useAdminCounters } from "../../hooks/useAdminCounters.js";

/**
 * The deep-navy sidebar. Split out of the old AdminLayout so the
 * shell composition (AdminShell) stays clean and each piece can
 * grow independently.
 *
 * Nav is data-driven \u2014 add a new section by editing CATALOG_ITEMS
 * or TOP_LINKS. "Soon" tags render as disabled hints.
 */
const CATALOG_ITEMS = [
  { label: "Products", to: "/admin/products", live: true },
  { label: "Categories", live: false },
  { label: "Brands", live: false },
  { label: "Attributes", live: false },
  { label: "Collections", live: false },
];

const TOP_LINKS = [
  { label: "Orders",     icon: ShoppingCart, live: true,  to: "/admin/orders",    badgeKey: "pendingOrders" },
  { label: "Customers",  icon: Users,        live: true,  to: "/admin/customers" },
  { label: "Inventory",  icon: Boxes,        live: false },
  { label: "Marketing",  icon: Megaphone,    live: false },
  { label: "Reports",    icon: Tags,         live: true,  to: "/admin/reports" },
  { label: "Warranty",   icon: ShieldCheck,  live: true,  to: "/admin/warranty",  badgeKey: "openWarranty" },
  { label: "Reviews",    icon: Star,         live: false },
];

const CHANNELS = ["Website", "Mobile App", "POS"];

export default function AdminSidebar({ open, onNavigate }) {
  const [catalogOpen, setCatalogOpen] = useState(true);
  const counters = useAdminCounters();

  return (
    <aside className={"adm-sidebar" + (open ? " adm-sidebar--open" : "")}>
      <div className="adm-sidebar__brand">
        <Link to="/" onClick={onNavigate}>
          <Logo tagline={false} />
        </Link>
        <span className="adm-sidebar__tag">Admin Console</span>
      </div>

      <nav className="adm-nav">
        <NavLink
          to="/admin"
          end
          className={({ isActive }) => "adm-nav__link" + (isActive ? " adm-nav__link--on" : "")}
          onClick={onNavigate}
        >
          <span><LayoutDashboard size={17} /> Dashboard</span>
        </NavLink>

        <button
          className={"adm-nav__group-head" + (catalogOpen ? " adm-nav__link--on" : "")}
          onClick={() => setCatalogOpen((v) => !v)}
          aria-expanded={catalogOpen}
        >
          <span><Package size={17} /> Catalog</span>
          <ChevronDown size={14} className={catalogOpen ? "adm-chev adm-chev--open" : "adm-chev"} />
        </button>
        {catalogOpen && (
          <div className="adm-nav__group">
            {CATALOG_ITEMS.map((item) =>
              item.live ? (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) => "adm-nav__sublink" + (isActive ? " adm-nav__sublink--on" : "")}
                  onClick={onNavigate}
                >
                  {item.label}
                </NavLink>
              ) : (
                <span key={item.label} className="adm-nav__sublink adm-nav__sublink--soon">
                  {item.label} <em>Soon</em>
                </span>
              )
            )}
          </div>
        )}

        {TOP_LINKS.map(({ label, icon: Icon, badgeKey, live, to }) => {
          const badge = badgeKey ? counters[badgeKey] : null;
          if (live && to) {
            return (
              <NavLink
                key={label}
                to={to}
                className={({ isActive }) => "adm-nav__link" + (isActive ? " adm-nav__link--on" : "")}
                onClick={onNavigate}
              >
                <span><Icon size={17} /> {label}</span>
                {badge != null && badge > 0 && <em className="adm-nav__badge">{badge}</em>}
              </NavLink>
            );
          }
          return (
            <span key={label} className="adm-nav__link adm-nav__link--soon">
              <span><Icon size={17} /> {label}</span>
              {badge != null && badge > 0
                ? <em className="adm-nav__badge">{badge}</em>
                : <em>Soon</em>}
            </span>
          );
        })}

        <NavLink
          to="/admin/settings"
          className={({ isActive }) => "adm-nav__link" + (isActive ? " adm-nav__link--on" : "")}
          onClick={onNavigate}
        >
          <span><SettingsIcon size={17} /> Settings</span>
        </NavLink>
      </nav>

      <div className="adm-sidebar__channels">
        <p className="adm-nav__section-label">Sales Channel</p>
        {CHANNELS.map((c) => (
          <span key={c} className="adm-nav__sublink adm-nav__sublink--soon">
            {c} <em>Soon</em>
          </span>
        ))}
      </div>

      <a href="mailto:support@voltory.ng" className="adm-sidebar__help">
        <b><LifeBuoy size={13} /> Need Help?</b>
        <small>Contact support</small>
      </a>
    </aside>
  );
}