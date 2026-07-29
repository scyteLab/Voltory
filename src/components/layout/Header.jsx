import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Heart, LogIn, Menu, Repeat, ShoppingCart, UserPlus, X } from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import { SITE } from "../../config/site.js";
import Logo from "./Logo.jsx";
import SearchBar from "../search/SearchBar.jsx";
import AccountMenu from "./AccountMenu.jsx";

export default function Header() {
  const { count, wishlistCount, compareCount } = useStore();
  const { customer } = useCustomerAuth();
  const account = customer; // JSX below uses `account ? ...` \u2014 keep the name local
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [menuOpen]);

  return (
    <header className="hdr">
      <div className="wrap hdr__inner">
        <Link to="/" aria-label="Home"><Logo /></Link>
        <SearchBar />
        <div className="hdr__counters">
          <Link to="/compare" className="hdr-counter" aria-label="Compare">
            <span className="hdr-counter__icon">
              <Repeat size={20} />
              <span className="hdr-counter__num">{compareCount}</span>
            </span>
            <span>Compare</span>
          </Link>
          <Link to="/account/wishlist" className="hdr-counter" aria-label="Wishlist">
            <span className="hdr-counter__icon">
              <Heart size={20} />
              <span className="hdr-counter__num">{wishlistCount}</span>
            </span>
            <span>Wishlist</span>
          </Link>
          <Link to="/cart" className="hdr-counter" aria-label="Cart">
            <span className="hdr-counter__icon">
              <ShoppingCart size={20} />
              <span className="hdr-counter__num">{count}</span>
            </span>
            <span>Cart</span>
          </Link>
          <button
            className="hdr__burger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div className="hdr-drawer__backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="hdr-drawer" aria-label="Mobile menu">
            <ul className="hdr-drawer__links">
              {SITE.mainNav.map((l) => (
                <li key={l.label}>
                  <NavLink
                    to={l.to}
                    end={l.to === "/"}
                    className={({ isActive }) =>
                      "hdr-drawer__link" +
                      (l.highlight ? " hdr-drawer__link--hl" : "") +
                      (isActive ? " hdr-drawer__link--on" : "")
                    }
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="hdr-drawer__auth">
              {account ? (
                <AccountMenu />
              ) : (
                <>
                  <Link to="/login" className="hdr-drawer__signin">
                    <LogIn size={16} /> Sign In
                  </Link>
                  <Link to="/signup" className="hdr-drawer__signup">
                    <UserPlus size={16} /> Sign Up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
  );
}