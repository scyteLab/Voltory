import { useState } from "react";
import Icon from "../../ui/Icon.jsx";

/**
 * IconPicker \u2014 grid of icon names, one selectable.
 *
 * Uses the storefront's shared Icon registry (from ui/Icon.jsx) so
 * that whatever the admin picks here renders identically on the
 * storefront category sidebar. Picking an icon outside this list
 * would render as the fallback circle \u2014 hence a fixed picker.
 */

/**
 * Ordered list of icons that make sense for category use.
 * Reorderable / expandable \u2014 mirrors the registry in ui/Icon.jsx
 * but curates the household-appliance-friendly ones first.
 */
const CATEGORY_ICONS = [
  // Appliance-flavoured (most likely picks first)
  "Refrigerator", "WashingMachine", "AirVent", "Tv", "CookingPot", "Blend",
  "Wrench", "Zap", "Cable", "Lock", "Headphones", "Smartphone", "Rocket",

  // Generic
  "Package", "ShoppingCart", "Home", "Building2", "Truck", "Tag",
  "LayoutGrid", "TrendingUp", "Award", "Heart", "Search", "Eye",
  "MapPin", "Phone", "MessageCircle", "User", "Users", "Wallet",
  "CreditCard", "Banknote", "Receipt", "ShieldCheck", "BadgeCheck",
  "Clock", "FileBadge", "ScrollText", "LifeBuoy", "Play", "Repeat",
];

export default function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ipk">
      <button
        type="button"
        className="ipk__trigger"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ipk__preview">
          <Icon name={value || "Package"} size={18} />
        </span>
        <span className="ipk__label">
          {value || <em>Pick an icon</em>}
        </span>
      </button>

      {open && (
        <div className="ipk__panel" role="listbox">
          {CATEGORY_ICONS.map((name) => (
            <button
              key={name}
              type="button"
              className={"ipk__cell" + (name === value ? " ipk__cell--on" : "")}
              onClick={() => { onChange(name); setOpen(false); }}
              title={name}
            >
              <Icon name={name} size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}