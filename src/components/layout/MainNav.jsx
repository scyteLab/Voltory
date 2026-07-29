import { NavLink, Link } from "react-router-dom";
import { LogIn, UserPlus } from "lucide-react";
import { SITE } from "../../config/site.js";
import { useCustomerAuth } from "../../context/AuthContext.jsx";
import AccountMenu from "./AccountMenu.jsx";

/**
 * Main nav row under the header. When signed out: Sign In / Sign Up
 * buttons. When signed in: AccountMenu dropdown.
 *
 * Reads sign-in state from AuthContext (Supabase-backed session).
 */
export default function MainNav() {
  const { customer } = useCustomerAuth();
  const account = customer;
  return (
    <nav className="mainnav" aria-label="Primary">
      <div className="wrap mainnav__inner">
        <span className="mainnav__cats-spacer" aria-hidden="true" />
        <ul className="mainnav__list">
          {SITE.mainNav.map((l) => (
            <li key={l.label}>
              <NavLink
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  "mainnav__link" +
                  (l.highlight ? " mainnav__link--hl" : "") +
                  (isActive ? " mainnav__link--on" : "")
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mainnav__auth">
          {account ? (
            <AccountMenu />
          ) : (
            <>
              <Link to="/login" className="mainnav__signin">
                <LogIn size={15} /> Sign In
              </Link>
              <Link to="/signup" className="mainnav__signup">
                <UserPlus size={15} /> Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}