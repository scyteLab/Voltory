import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight, ChevronRight, Compass, Home as HomeIcon,
  Package, Search, ShoppingBag, Tag,
} from "lucide-react";
import { SITE } from "../config/site.js";

/**
 * 404 page \u2014 mounted as the wildcard route inside <StoreLayout>,
 * so the full header / nav / footer still wrap it. Lost users
 * get popular destinations and a quick-jump search.
 */
const QUICK_LINKS = [
  { to: "/", label: "Home", icon: HomeIcon, blurb: "Browse our full catalogue" },
  { to: "/deals", label: "Deals of the Day", icon: Tag, blurb: "Limited-time offers" },
  { to: "/brands", label: "Shop by Brand", icon: ShoppingBag, blurb: "Scanfrost, Midea, Samsung & more" },
  { to: "/best-sellers", label: "Best Sellers", icon: Package, blurb: "What Nigerians are buying" },
];

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  useEffect(() => {
    const prev = document.title;
    document.title = `Page not found \u2014 ${SITE.name}`;
    return () => { document.title = prev; };
  }, []);

  function onSearch(e) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <main className="wrap notfound">
      <section className="nf-hero">
        <span className="nf-hero__code">404</span>
        <img className="nf-hero__img" src="/banners/nf-hero.png" alt="" />
        <h1>This page wandered off</h1>
        <p>
          We couldn’t find <b className="mono">{location.pathname}</b>. The link
          may have changed, or the page may not exist yet. Try one of these popular
          destinations, or search for what you need.
        </p>

        <form onSubmit={onSearch} className="nf-search">
          <Search size={16} />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, brands, categories..."
            aria-label="Search"
          />
          <button type="submit">
            <ArrowRight size={16} />
          </button>
        </form>
      </section>

      <section className="nf-grid">
        {QUICK_LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="nf-tile">
            <span className="nf-tile__icon"><l.icon size={22} /></span>
            <div>
              <b>{l.label}</b>
              <small>{l.blurb}</small>
            </div>
            <ChevronRight size={16} className="nf-tile__chev" />
          </Link>
        ))}
      </section>

      <p className="nf-help">
        Still stuck?{" "}
        <Link to="/help">Visit the Help Center</Link>{" "}
        or{" "}
        <Link to="/contact">contact our support team</Link>.
      </p>
    </main>
  );
}