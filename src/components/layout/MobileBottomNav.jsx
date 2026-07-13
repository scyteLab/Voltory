import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Grid, Home as HomeIcon, ShoppingCart, User, X,
} from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";
import { CATEGORIES } from "../../data/products.js";
import Icon from "../ui/Icon.jsx";

/**
 * Mobile-only sticky bottom nav. Hidden above 920px via CSS.
 * Four tabs:
 *   Home       \u2014 jumps to /
 *   Categories \u2014 opens a slide-up sheet listing all 9 categories
 *   Cart       \u2014 jumps to /cart with item-count badge
 *   Account    \u2014 jumps to /account (auth-gated) or /login if signed out
 *
 * The Categories sheet auto-closes whenever the URL changes \u2014 so
 * tapping a category navigates and the sheet dismisses naturally.
 */
export default function MobileBottomNav() {
  const { count, account } = useStore();
  const [catsOpen, setCatsOpen] = useState(false);
  const location = useLocation();

  // Close the categories sheet whenever the route changes.
  useEffect(() => { setCatsOpen(false); }, [location.pathname, location.search]);

  // Prevent body scroll while the sheet is open.
  useEffect(() => {
    if (catsOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [catsOpen]);

  return (
    <>
      <nav className="mbnav" aria-label="Mobile navigation">
        <NavLink to="/" end className={({ isActive }) => "mbnav__tab" + (isActive ? " mbnav__tab--on" : "")}>
          <HomeIcon size={20} />
          <span>Home</span>
        </NavLink>

        <button
          type="button"
          className={"mbnav__tab" + (catsOpen ? " mbnav__tab--on" : "")}
          onClick={() => setCatsOpen((v) => !v)}
          aria-expanded={catsOpen}
        >
          <Grid size={20} />
          <span>Categories</span>
        </button>

        <NavLink to="/cart" className={({ isActive }) => "mbnav__tab" + (isActive ? " mbnav__tab--on" : "")}>
          <span className="mbnav__icon-wrap">
            <ShoppingCart size={20} />
            {count > 0 && <em className="mbnav__badge">{count}</em>}
          </span>
          <span>Cart</span>
        </NavLink>

        <NavLink
          to={account ? "/account" : "/login?return=/account"}
          className={({ isActive }) =>
            "mbnav__tab" + ((isActive || location.pathname.startsWith("/account")) ? " mbnav__tab--on" : "")
          }
        >
          <User size={20} />
          <span>{account ? "Account" : "Sign In"}</span>
        </NavLink>
      </nav>

      {/* Categories slide-up sheet */}
      {catsOpen && (
        <>
          <div className="mbsheet__backdrop" onClick={() => setCatsOpen(false)} />
          <div className="mbsheet" role="dialog" aria-label="Shop by category">
            <div className="mbsheet__head">
              <b>Shop by Category</b>
              <button onClick={() => setCatsOpen(false)} aria-label="Close categories">
                <X size={18} />
              </button>
            </div>
            <ul className="mbsheet__list">
              {CATEGORIES.map((c) => (
                <li key={c.id}>
                  <Link to={`/category/${c.id}`}>
                    <span className="mbsheet__icon"><Icon name={c.icon} size={18} /></span>
                    <div>
                      <b>{c.label}</b>
                      <small>{c.blurb}</small>
                    </div>
                    {c.hot && <span className="mbsheet__hot">Hot</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </>
  );
}