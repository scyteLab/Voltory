import { Link } from "react-router-dom";
import { useEffect, useMemo } from "react";
import {
  BadgeCheck, ChevronRight, Home as HomeIcon, Store,
  Refrigerator, AirVent, WashingMachine, Tv, UtensilsCrossed,
  CookingPot, Zap, Cable,
} from "lucide-react";
import { BRANDS, CATEGORIES, PRODUCTS } from "../data/products.js";
import { SITE } from "../config/site.js";
import BrandLogo from "../components/brand/BrandLogo.jsx";

const ICON_MAP = {
  Refrigerator, AirVent, WashingMachine, Tv,
  Blend: UtensilsCrossed, CookingPot, Zap, Cable,
};

const SECTION_COLORS = [
  { bg: "var(--p-dark)",  ink: "#fff" },
  { bg: "var(--p)",       ink: "#fff" },
  { bg: "#e8ecf1",        ink: "var(--ink)" },
  { bg: "var(--p-deep)",  ink: "#fff" },
  { bg: "var(--p)",       ink: "#fff" },
  { bg: "#e0e7ef",        ink: "var(--ink)" },
  { bg: "var(--p-dark)",  ink: "#fff" },
  { bg: "var(--p)",       ink: "#fff" },
];

export default function Brands() {
  useEffect(() => {
    const prev = document.title;
    document.title = `Official Stores — ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  const categoryBrands = useMemo(() => {
    return CATEGORIES
      .map((cat) => {
        const catProducts = PRODUCTS.filter((p) => p.category === cat.id);
        const brandNames = [...new Set(catProducts.map((p) => p.brand))];
        const brands = brandNames
          .map((name) => {
            const brand = BRANDS.find((b) => b.name === name);
            if (!brand) return null;
            const firstProduct = catProducts.find((p) => p.brand === name);
            return { ...brand, bgImage: firstProduct?.image };
          })
          .filter(Boolean);
        return { cat, brands };
      })
      .filter(({ brands }) => brands.length > 0);
  }, []);

  return (
    <main className="wrap">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>Official Stores</span>
      </nav>

      <section className="bdir-hero">
        <div>
          <span className="bdir-hero__pill">
            <BadgeCheck size={13} /> AUTHORIZED DISTRIBUTOR
          </span>
          <h1>Official Stores</h1>
          <p>
            Shop original products direct from the world's leading appliance makers —
            manufacturer warranty and after-sales support across Nigeria.
          </p>
        </div>
        <span className="bdir-hero__icon"><Store size={56} strokeWidth={1.1} /></span>
      </section>

      {categoryBrands.map(({ cat, brands }, i) => {
        const color = SECTION_COLORS[i % SECTION_COLORS.length];
        const Icon = ICON_MAP[cat.icon] || Store;
        return (
          <section key={cat.id} className="bcat-section">
            <div
              className="bcat-header"
              style={{ background: color.bg, color: color.ink }}
            >
              <Icon size={18} />
              <span>{cat.label} Brands</span>
            </div>
            <div className="bcat-row">
              {brands.map((b) => (
                <BrandTile key={b.id} brand={b} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function BrandTile({ brand }) {
  return (
    <Link
      to={`/brand/${brand.id}`}
      className="bcat-tile"
      style={brand.bgImage ? { backgroundImage: `url(${brand.bgImage})` } : undefined}
    >
      <span className="bcat-tile__overlay" />
      <span className="bcat-tile__logo">
        <BrandLogo brand={brand} size="md" />
      </span>
    </Link>
  );
}
