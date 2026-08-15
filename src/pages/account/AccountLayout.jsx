import { Link, NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import {
  ChevronRight, Heart, Home as HomeIcon, LogOut, MapPin,
  MessageSquare, Package, User,
} from "lucide-react";
import { useCustomerAuth } from "../../context/AuthContext.jsx";

/**
 * Shell for every /account/* route. If the user isn't signed in,
 * we redirect to /login. Once signed in, name/phone shown at the
 * top of the sidebar come from the Supabase-backed customer row.
 *
 * Loading state: shows nothing until AuthContext resolves the
 * session on mount — avoids the flash of "not signed in → redirect"
 * that would happen on refresh otherwise.
 */
const LINKS = [
  { to: "/account",           icon: User,          label: "Account Overview", end: true },
  { to: "/account/orders",    icon: Package,       label: "My Orders" },
  { to: "/account/addresses", icon: MapPin,        label: "Saved Addresses" },
  { to: "/account/reviews",   icon: MessageSquare, label: "My Reviews" },
  { to: "/account/wishlist",  icon: Heart,         label: "Wishlist" },
];

export default function AccountLayout() {
  const { customer, loading, signOut } = useCustomerAuth();
  const navigate = useNavigate();

  // Still resolving the session (initial mount) — render nothing.
  if (loading) return null;
  // Session resolved and no customer — not signed in.
  if (!customer) return <Navigate to="/login?return=/account" replace />;

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  const displayName = customer.name || "NAVEN customer";
  // customer.phone is stored as +2348012345678; strip the +234 for
  // display so it reads as a familiar 08... number.
  const displayPhone = (customer.phone || "").startsWith("+234")
    ? "0" + customer.phone.slice(4)
    : customer.phone;

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
              <b>{displayName}</b>
              <small className="mono">{displayPhone}</small>
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