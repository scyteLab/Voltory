import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ChevronRight, Heart, Home as HomeIcon, LogOut, MapPin, Package, User,
} from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";

/**
 * Shell for every /account/* route. Profile card on top of the
 * sidebar, navigation below; <Outlet/> on the right for the
 * specific account page. Wrapped in <AuthGuard> at the router
 * level, so we can assume `account` exists here.
 */
const LINKS = [
  { to: "/account",           icon: User,    label: "Account Overview", end: true },
  { to: "/account/orders",    icon: Package, label: "My Orders" },
  { to: "/account/addresses", icon: MapPin,  label: "Saved Addresses" },
  { to: "/account/wishlist",  icon: Heart,   label: "Wishlist" },
];

export default function AccountLayout() {
  const { account, signOut } = useStore();
  const navigate = useNavigate();

  function handleSignOut() {
    signOut();
    navigate("/");
  }

  return (
    <main className="wrap">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>My Account</span>
      </nav>

      <div className="acct-shell">
        <aside className="acct-side">
          <div className="acct-side__head">
            <span className="acct-side__avatar"><User size={22} /></span>
            <div>
              <b>{account.name || "Voltory customer"}</b>
              <small className="mono">{account.phone}</small>
            </div>
          </div>
          <ul className="acct-side__nav">
            {LINKS.map((l) => (
              <li key={l.to}>
                <NavLink
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    "acct-side__link" + (isActive ? " acct-side__link--on" : "")
                  }
                >
                  <l.icon size={16} />
                  <span>{l.label}</span>
                  <ChevronRight size={13} className="acct-side__chev" />
                </NavLink>
              </li>
            ))}
          </ul>
          <button className="acct-side__signout" onClick={handleSignOut}>
            <LogOut size={15} /> Sign Out
          </button>
        </aside>

        <section className="acct-main">
          <Outlet />
        </section>
      </div>
    </main>
  );
}