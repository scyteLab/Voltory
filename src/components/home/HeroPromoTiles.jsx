import { Link } from "react-router-dom";
import { Gift, ShieldCheck, Star, Truck } from "lucide-react";

/**
 * Hero promo tiles \u2014 the two side-by-side call-outs shown next to
 * the hero on desktop.
 *
 * Configurable via the site_sections table. Each tile has:
 *   { kind: "warm" | "cool", title, subtitle, cta, href, image? }
 *
 * If no config is provided, falls back to the tiles that used to
 * live inline in Home.jsx (Freezer Promo + Inverter ACs).
 */

const DEFAULTS = [
  {
    kind: "warm",
    title: "Freezer Promo",
    subtitle: "Buy any Freezer & get a <b>FREE Umbrella!</b>",
    cta: "Shop Now",
    href: "/deals",
    image: "/products/ref.png",
    tag: "Limited Offer",
    badges: ["Top Brands", "Warranty", "Fast Delivery"],
  },
  {
    kind: "cool",
    title: "Inverter ACs",
    subtitle: "Save up to <b>60% on energy</b> bills this season",
    cta: "Shop ACs",
    href: "/category/air-conditioners",
    image: "/products/ac.png",
    tag: "Best Sellers",
    badges: ["Great Prices", "Warranty", "Free Install"],
  },
];

const TAG_ICONS = { warm: Gift, cool: Star };
const DEFAULT_BADGES = ["Top Brands", "Warranty", "Fast Delivery"];
const BADGE_ICONS = [Star, ShieldCheck, Truck];

export default function HeroPromoTiles({ config = {} }) {
  const tiles = Array.isArray(config.tiles) && config.tiles.length > 0
    ? config.tiles.map((t, i) => ({ ...DEFAULTS[i] || DEFAULTS[0], ...t }))
    : DEFAULTS;

  return (
    <aside className="hero-promos">
      {tiles.map((t, i) => {
        const TagIcon = TAG_ICONS[t.kind] || Gift;
        const badges = Array.isArray(t.badges) && t.badges.length ? t.badges : DEFAULT_BADGES;
        return (
          <Link
            key={i}
            to={t.href || "/"}
            className={`hero-promo hero-promo--${t.kind || "warm"}`}
          >
            <div className={`hero-promo__tag${t.kind === "cool" ? " hero-promo__tag--alt" : ""}`}>
              <TagIcon size={10} /> {t.tag || (t.kind === "cool" ? "Best Sellers" : "Limited Offer")}
            </div>
            <h3 className="hero-promo__title">{t.title}</h3>
            {t.subtitle && (
              <p className="hero-promo__sub" dangerouslySetInnerHTML={{ __html: t.subtitle }} />
            )}
            {t.image && <img className="hero-promo__img" src={t.image} alt="" />}
            <span className="hero-promo__cta">{t.cta || "Shop Now"}</span>
            <div className="hero-promo__badges">
              {badges.slice(0, 3).map((b, bi) => {
                const Icon = BADGE_ICONS[bi] || Star;
                return (
                  <span key={bi}><Icon size={9} /> {b}</span>
                );
              })}
            </div>
          </Link>
        );
      })}
    </aside>
  );
}