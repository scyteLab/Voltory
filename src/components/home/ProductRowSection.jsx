import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCatalog } from "../../context/CatalogContext.jsx";
import ProductCard from "../product/ProductCard.jsx";
import CountdownTimer from "./CountdownTimer.jsx";

/**
 * ProductRowSection — the biggest configurable section type.
 *
 * A horizontal scrollable product row with a header. Powers
 * "Deals of the day", "Recommended products", and any custom row
 * the admin creates in Session 31b.
 *
 * Configurable via `config`:
 *   · title           — header text
 *   · link            — optional { text, href } (e.g. "View all deals →")
 *   · show_countdown  — boolean; renders a countdown next to the title
 *   · source          — "auto" | { tag, category, brand, skus, limit }
 *   · limit           — max products to show (default 10)
 *
 * `source: "auto"` means:
 *   · If kind was 'deals_row' — all products with a `was` price
 *   · If kind was 'featured_row' — first N products
 * Since we don't have kind at this level, we use `source.mode` or
 * fall back to "featured".
 *
 * `source: { tag: "holiday-sale" }` — all products with that tag
 * `source: { category: "air-conditioners" }` — all products in the category
 * `source: { brand: "Scanfrost" }` — all products from that brand
 * `source: { skus: ["A", "B"] }` — exactly those SKUs, in order
 */
export default function ProductRowSection({ config = {}, sectionKind }) {
  const { products, getDeals, byCategory, byBrand, bySku } = useCatalog();
  const ref = useRef(null);
  const limit = Number(config.limit) || 10;

  // Resolve which products to show
  let items = [];
  const source = config.source;

  if (source === "auto" || !source) {
    // Fall back based on the section kind
    if (sectionKind === "deals_row") items = getDeals();
    else items = products; // featured_row default
  } else if (typeof source === "object" && source !== null) {
    if (Array.isArray(source.skus) && source.skus.length > 0) {
      items = source.skus.map(bySku).filter(Boolean);
    } else if (source.category) {
      items = byCategory(source.category);
    } else if (source.brand) {
      items = byBrand(source.brand);
    } else if (source.tag) {
      const tag = String(source.tag).toLowerCase();
      items = products.filter((p) =>
        Array.isArray(p.tags) && p.tags.some((t) => String(t).toLowerCase() === tag)
      );
    } else {
      items = products;
    }
  }

  items = items.slice(0, limit);

  if (items.length === 0) return null;

  function scroll(dir) {
    const el = ref.current;
    if (!el) return;
    const card = el.firstElementChild;
    const amount = card ? card.offsetWidth * 3 : el.offsetWidth * 0.7;
    const start = el.scrollLeft;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min((now - t0) / 500, 1);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      el.scrollLeft = start + dir * amount * ease;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const title = config.title || "Products";
  const link = config.link; // { text, href } or undefined

  return (
    <>
      <div className="section-head">
        <h2>{title}</h2>
        {config.show_countdown ? (
          <div className="deals-flash">
            <CountdownTimer />
            {link?.href && (
              <Link to={link.href} style={{ fontSize: 13, fontWeight: 600, color: "var(--p)" }}>
                {link.text || "View all"}
              </Link>
            )}
          </div>
        ) : link?.href ? (
          <Link to={link.href}>{link.text || "View all"} <ChevronRight size={14} /></Link>
        ) : null}
      </div>

      <div className="pgrid-wrap">
        <button
          className="pgrid-arrow pgrid-arrow--l"
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
        >
          <ChevronLeft size={16} />
        </button>
        <section className="pgrid" ref={ref} aria-label={title}>
          {items.map((p) => <ProductCard key={p.sku} product={p} />)}
        </section>
        <button
          className="pgrid-arrow pgrid-arrow--r"
          onClick={() => scroll(1)}
          aria-label="Scroll right"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}