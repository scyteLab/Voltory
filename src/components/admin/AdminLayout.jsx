import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  Bell, Boxes, ChevronDown, HelpCircle, LayoutDashboard, LifeBuoy, LogOut,
  Megaphone, Menu, Package, Search, Settings as SettingsIcon, ShieldCheck,
  ShoppingCart, Star, Tags, Users, X,
} from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import Logo from "../layout/Logo.jsx";

const CATALOG_ITEMS = [
  { label: "Products", to: "/admin/products", live: true },
  { label: "Categories", live: false },
  { label: "Brands", live: false },
  { label: "Attributes", live: false },
  { label: "Collections", live: false },
];

const TOP_LINKS = [
  { label: "Orders", icon: ShoppingCart, live: false },
  { label: "Customers", icon: Users, live: false },
  { label: "Inventory", icon: Boxes, live: false },
  { label: "Marketing", icon: Megaphone, live: false },
  { label: "Reports", icon: Tags, live: false },
  { label: "Warranty", icon: ShieldCheck, live: false },
  { label: "Reviews", icon: Star, live: false },
];

const CHANNELS = ["Website", "Mobile App", "POS"];

export default function AdminLayout() {
  const { admin, signOutAdmin } = useAdmin();
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="adm-shell">
      <aside className={"adm-sidebar" + (drawerOpen ? " adm-sidebar--open" : "")}>
        <div className="adm-sidebar__brand">
          <Link to="/" onClick={() => setDrawerOpen(false)}>
            <Logo tagline={false} />
          </Link>
          <span className="adm-sidebar__tag">Admin Console</span>
        </div>

        <nav className="adm-nav">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) => "adm-nav__link" + (isActive ? " adm-nav__link--on" : "")}
            onClick={() => setDrawerOpen(false)}
          >
            <LayoutDashboard size={17} /> Dashboard
          </NavLink>

          <button className="adm-nav__group-head" onClick={() => setCatalogOpen((v) => !v)}>
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
                    onClick={() => setDrawerOpen(false)}
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

          {TOP_LINKS.map(({ label, icon: Icon }) => (
            <span key={label} className="adm-nav__link adm-nav__link--soon">
              <Icon size={17} /> {label} <em>Soon</em>
            </span>
          ))}

          <NavLink
            to="/admin/settings"
            className={({ isActive }) => "adm-nav__link" + (isActive ? " adm-nav__link--on" : "")}
            onClick={() => setDrawerOpen(false)}
          >
            <SettingsIcon size={17} /> Settings
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
          <LifeBuoy size={15} /> Need Help? Contact Support
        </a>
      </aside>

      {drawerOpen && <div className="adm-sidebar__backdrop" onClick={() => setDrawerOpen(false)} />}

      <div className="adm-main">
        <header className="adm-topbar">
          <button className="adm-topbar__burger" onClick={() => setDrawerOpen((v) => !v)} aria-label="Toggle menu">
            {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <label className="adm-search">
            <Search size={16} />
            <input type="text" placeholder="Search products, orders, customers…" disabled />
            <kbd>⌘K</kbd>
          </label>
          <div className="adm-topbar__right">
            <button className="adm-icon-btn" aria-label="Notifications" disabled>
              <Bell size={18} />
            </button>
            <button className="adm-icon-btn" aria-label="Help" disabled>
              <HelpCircle size={18} />
            </button>
            <div className="adm-user">
              <span className="adm-user__avatar">{(admin?.email || "?")[0].toUpperCase()}</span>
              <span className="adm-user__meta">
                <b>{admin?.email}</b>
                <small>Super Admin</small>
              </span>
              <button className="adm-user__signout" onClick={signOutAdmin} aria-label="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="adm-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
