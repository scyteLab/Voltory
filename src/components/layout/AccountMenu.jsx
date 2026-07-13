import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown, Heart, LogOut, MapPin, Package, User,
} from "lucide-react";
import { useStore } from "../../context/StoreContext.jsx";

/**
 * Account dropdown in the main nav. Shown only when the user is
 * signed in; sign-out clears the account and routes home.
 */
export default function AccountMenu() {
  const { account, signOut } = useStore();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDown(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (!account) return null;
  const firstName = (account.name || "").split(/\s+/)[0] || "there";

  function handleSignOut() {
    signOut();
    setOpen(false);
    navigate("/");
  }

  return (
    <div className="acctmenu" ref={wrapRef}>
      <button
        type="button"
        className={"acctmenu__trigger" + (open ? " acctmenu__trigger--open" : "")}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="acctmenu__avatar"><User size={15} /></span>
        <span className="acctmenu__hi">
          <small>Hi, {firstName}</small>
          <b>My Account</b>
        </span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="acctmenu__panel" role="menu">
          <div className="acctmenu__head">
            <span className="acctmenu__bigavatar"><User size={20} /></span>
            <div>
              <b>{account.name || "Voltory customer"}</b>
              <small className="mono">{account.phone}</small>
            </div>
          </div>
          <Link to="/account" className="acctmenu__link" onClick={() => setOpen(false)}>
            <User size={15} /> Account Overview
          </Link>
          <Link to="/account/orders" className="acctmenu__link" onClick={() => setOpen(false)}>
            <Package size={15} /> My Orders
          </Link>
          <Link to="/account/addresses" className="acctmenu__link" onClick={() => setOpen(false)}>
            <MapPin size={15} /> Saved Addresses
          </Link>
          <Link to="/account/wishlist" className="acctmenu__link" onClick={() => setOpen(false)}>
            <Heart size={15} /> Wishlist
          </Link>
          <div className="acctmenu__sep" />
          <button className="acctmenu__signout" onClick={handleSignOut}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}