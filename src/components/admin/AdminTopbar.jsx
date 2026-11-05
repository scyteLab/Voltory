import { useState } from "react";
import { Bell, HelpCircle, KeyRound, LogOut, Menu, Search, X } from "lucide-react";
import { useAdmin } from "../../context/AdminContext.jsx";
import { roleLabel } from "../../config/permissions.js";
import { useAdminCounters } from "../../hooks/useAdminCounters.js";

/**
 * The topbar. Owns:
 *   · mobile burger toggle
 *   · global search (opens ⌘K palette)
 *   · notification bell with LIVE badge
 *   · help icon
 *   · user cluster with email, role badge, change password, sign-out
 */
export default function AdminTopbar({ drawerOpen, onToggleDrawer, onOpenPalette }) {
  const { admin, role, signOutAdmin } = useAdmin();
  const [pwOpen, setPwOpen] = useState(false);
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
            <small>
              <span className={"adm-role-badge adm-role-badge--" + (role || "none")}>{roleLabel(role)}</span>
            </small>
          </span>
          <button
            className="adm-user__signout"
            onClick={() => setPwOpen(true)}
            aria-label="Change password"
            title="Change password"
          >
            <KeyRound size={16} />
          </button>
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
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
    </header>
  );
}

/** Lets staff replace the temporary password the GM gave them. */
function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAdmin();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind, text }

  async function submit(e) {
    e.preventDefault();
    if (next.length < 10) return setMsg({ kind: "err", text: "Use at least 10 characters." });
    if (next !== confirm) return setMsg({ kind: "err", text: "The new passwords don't match." });
    setBusy(true);
    setMsg(null);
    try {
      await changePassword(current, next);
      setMsg({ kind: "ok", text: "Password changed." });
      setTimeout(onClose, 1200);
    } catch (err) {
      setMsg({ kind: "err", text: err.message || "Couldn't change the password." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="team-modal" onClick={() => !busy && onClose()}>
      <form className="team-modal__card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Change password</h3>
        <div className="team-modal__field">
          <label>Current password</label>
          <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} disabled={busy} required />
        </div>
        <div className="team-modal__field">
          <label>New password</label>
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} disabled={busy} required />
        </div>
        <div className="team-modal__field">
          <label>Confirm new password</label>
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} required />
        </div>
        {msg && <div className={"team-msg team-msg--" + msg.kind}>{msg.text}</div>}
        <div className="team-modal__actions">
          <button type="button" className="adm-btn adm-btn--secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
        </div>
      </form>
    </div>
  );
}