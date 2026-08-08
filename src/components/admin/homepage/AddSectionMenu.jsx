import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

/**
 * AddSectionMenu
 *
 * Dropdown that lets operators add another section to the homepage.
 * Every registered kind is available; sensible default configs are
 * seeded when a new section is added.
 */

const OPTIONS = [
  { kind: "hero_promo_tiles",  label: "Hero Promo Tiles",       hint: "Two side-by-side call-outs next to the hero" },
  { kind: "brand_tiles",       label: "Brand Tiles",            hint: "Horizontal strip of brand logos" },
  { kind: "deals_row",         label: "Deals Row",              hint: "Configurable product carousel + countdown" },
  { kind: "featured_row",      label: "Featured Products Row",  hint: "Configurable product carousel" },
  { kind: "category_strip",    label: "Category Strip",         hint: "Categories carousel" },
  { kind: "service_cards",     label: "Service Cards",          hint: "Delivery, warranty, installation" },
  { kind: "app_promo",         label: "App Promo Banner",       hint: "Download-the-app CTA" },
  { kind: "bottom_benefits",   label: "Bottom Benefits Strip",  hint: "Full-width trust bar" },
  { kind: "last_viewed",       label: "Recently Viewed",        hint: "Personalised, per visitor" },
];

const DEFAULT_CONFIGS = {
  hero_promo_tiles: {
    tiles: [
      { kind: "warm", title: "New promo", subtitle: "Add your subtitle here", cta: "Shop Now", href: "/deals" },
      { kind: "cool", title: "New promo", subtitle: "Add your subtitle here", cta: "Shop Now", href: "/" },
    ],
  },
  brand_tiles: { title: "Shop By Top Brands" },
  deals_row: { title: "New deals row", source: "auto", limit: 10, show_countdown: false },
  featured_row: { title: "New product row", source: "auto", limit: 10 },
};

export default function AddSectionMenu({ onAdd }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDown(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function pick(kind) {
    setOpen(false);
    const config = DEFAULT_CONFIGS[kind] || {};
    onAdd({ kind, config });
  }

  return (
    <div className="hb-addwrap" ref={wrapRef}>
      <button
        type="button"
        className="hb-add"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={16} /> Add section
      </button>
      {open && (
        <div className="hb-addmenu" role="menu">
          {OPTIONS.map((o) => (
            <button
              key={o.kind}
              type="button"
              className="hb-addmenu__item"
              onClick={() => pick(o.kind)}
            >
              <b>{o.label}</b>
              <small>{o.hint}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}