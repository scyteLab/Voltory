import { Bell, HelpCircle, LogOut, Menu, Search, X } from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import { useAdminCounters } from "../../hooks/useAdminCounters.js";

/**
 * The topbar. Owns:
 *   · mobile burger toggle
 *   · global search (opens ⌘K palette)
 *   · notification bell with LIVE badge
 *   · help icon
 *   · user cluster with role, avatar, sign-out
 */
export default function AdminTopbar({ drawerOpen, onToggleDrawer, onOpenPalette }) {
  const { admin, signOutAdmin } = useAdmin();
  const { notifications } = useAdminCounters();
  const initial = (admin?.email || "?")[0].toUpperCase();
  const showBadge = notifications != null && notifications > 0;

  return (
    <header className="adm-topbar">
      <button
        className="adm-topbar__burger"
        onClick={onToggleDrawer}
        aria-label={drawerOpen ? "Close menu" : "Open menu"}
      >
        {drawerOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <button
        className="adm-search"
        onClick={onOpenPalette}
        aria-label="Search"
        type="button"
      >
        <Search size={16} />
        <input
          type="text"
          placeholder="Search products, orders, customers…"
          readOnly
          tabIndex={-1}
        />
        <kbd>⌘ K</kbd>
      </button>

      <div className="adm-topbar__right">
        <button className="adm-icon-btn" aria-label="Notifications" title="Notifications">
          <Bell size={18} />
          {showBadge && (
            <span className="adm-icon-btn__badge">
              {notifications > 99 ? "99+" : notifications}
            </span>
          )}
        </button>

        <button className="adm-icon-btn" aria-label="Help" title="Help">
          <HelpCircle size={18} />
        </button>

        <div className="adm-user" role="button">
          <span className="adm-user__avatar">{initial}</span>
          <span className="adm-user__meta">
            <b>{admin?.email || "Admin User"}</b>
            <small>Super Admin</small>
          </span>
          <button
            className="adm-user__signout"
            onClick={signOutAdmin}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}