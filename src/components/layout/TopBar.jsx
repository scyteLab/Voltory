import { Link } from "react-router-dom";
import { BadgeCheck, Phone } from "lucide-react";
import { SITE } from "../../config/site.js";
import { useStore } from "../../context/StoreContext.jsx";
import Icon from "../ui/Icon.jsx";

/**
 * Slim utility bar. Welcome message on the left; quick links and
 * support phone on the right (Track Order, Help Center, etc.).
 */
export default function TopBar() {
  const { requestCall } = useStore();
  return (
    <div className="topbar">
      <div className="wrap topbar__inner">
        <div className="topbar__welcome">
          <BadgeCheck size={14} /> Welcome to the home of original electronics
        </div>
        <div className="topbar__links">
          {SITE.topbarLinks.map((l) => (
            <Link key={l.label} to={l.to} className="topbar__link">
              <Icon name={l.icon} size={13} /> <span>{l.label}</span>
            </Link>
          ))}
          <a
            href={`tel:${SITE.phone.replace(/\s/g, "")}`}
            className="topbar__link"
            onClick={(e) => { e.preventDefault(); requestCall(SITE.phone); }}
          >
            <Phone size={13} /> <b>{SITE.phone}</b>
          </a>
        </div>
      </div>
    </div>
  );
}