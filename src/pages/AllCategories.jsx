import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, ChevronRight, Flame, Home as HomeIcon, MessageCircle,
} from "lucide-react";
import { SITE } from "../config/site.js";
import { useCatalog } from "../context/CatalogContext.jsx";
import Icon from "../components/ui/Icon.jsx";

const CAT_IMAGES = {
  "refrigerators-freezers": "/products/sbs_ref.png",
  "air-conditioners": "/products/ac.png",
  "washing-machines": "/products/washing_machine.png",
  "televisions-audio": "/products/tv.png",
  "kitchen-appliances": "/products/blender.png",
  "small-appliances": "/products/cooker.png",
  "power-solutions": "/products/ups.png",
  "accessories": "/products/ups.png",
};

export default function AllCategories() {
  const { categories: CATEGORIES, brands: BRANDS, byCategory } = useCatalog();

  useEffect(() => {
    const prev = document.title;
    document.title = `All Categories — ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  return (
    <main className="wrap cats-page">
      <nav className="crumb" aria-label="Breadcrumb">
        <Link to="/"><HomeIcon size={13} /> Home</Link>
        <ChevronRight size={12} />
        <span>All Categories</span>
      </nav>

      {/* Hero */}
      <section className="cats-hero">
        <h1>Shop by Category</h1>
        <p>Browse {CATEGORIES.length} categories of original appliances from Nigeria's most trusted brands.</p>
      </section>

      {/* Category cards */}
      <section className="cats-grid">
        {CATEGORIES.map((c) => {
          const count = byCategory(c.id).length;
          const img = CAT_IMAGES[c.id];
          return (
            <Link to={`/category/${c.id}`} key={c.id} className="cat-card">
              <div className="cat-card__img">
                <img src={img} alt={c.label} loading="lazy" />
              </div>
              <div className="cat-card__body">
                <span className="cat-card__icon"><Icon name={c.icon} size={18} /></span>
                <h3>
                  {c.label}
                  {c.hot && <span className="cat-card__hot"><Flame size={10} /> Hot</span>}
                </h3>
                <p>{c.blurb}</p>
                <span className="cat-card__meta">{count} product{count !== 1 ? "s" : ""}</span>
                <span className="cat-card__cta">Shop Now <ArrowRight size={13} /></span>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Brands strip */}
      <section className="cats-brands">
        <h2>Shop by Brand</h2>
        <p>Find your favourite brand store</p>
        <div className="cats-brands__logos">
          {BRANDS.filter((b) => b.logo).map((b) => (
            <Link key={b.id} to={`/brand/${b.id}`} className="cats-brand-tile" title={b.name}>
              <img src={b.logo} alt={b.name} loading="lazy" />
            </Link>
          ))}
        </div>
        <Link to="/brands" className="cats-brands__cta">
          View all brands <ArrowRight size={14} />
        </Link>
      </section>

      {/* CTA */}
      <section className="mkt-cta">
        <div>
          <h2>Need help finding the right product?</h2>
          <p>Our team helps customers pick the right appliance every day.</p>
        </div>
        <div className="mkt-cta__actions">
          <a href={SITE.whatsappLink} target="_blank" rel="noreferrer" className="mkt-cta__wa">
            <MessageCircle size={16} /> Chat on WhatsApp
          </a>
          <Link to="/contact" className="mkt-cta__alt">
            Contact Us
          </Link>
        </div>
      </section>
    </main>
  );
}