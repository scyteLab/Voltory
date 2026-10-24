import { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { discountPct } from "../../utils/format.js";
import ProductCard from "../product/ProductCard.jsx";

const BRAND_ID = "scanfrost";
const LIMIT = 12;

/**
 * Scanfrost official store — brand card + a row of its in-stock products.
 *
 * Reads the live catalogue (it used to read the static data/products.js
 * list, which is empty since the move to Supabase — so only the row's
 * scroll arrows ever rendered). The row is omitted when there's nothing
 * to show, so no orphan arrows.
 */
export default function ScanfrostStore() {
  const { products, findBrand } = useCatalog();
  const brand = findBrand(BRAND_ID);
  const brandName = brand?.name || "Scanfrost";
  const ref = useRef(null);

  const items = useMemo(() => (
    products
      .filter((p) => p.brand === brandName && p.stock > 0 && p.status !== "inactive")
      .sort((a, b) => discountPct(b.price, b.was) - discountPct(a.price, a.was))
      .slice(0, LIMIT)
  ), [products, brandName]);

  function scroll(dir) {
    const el = ref.current;
    if (!el) return;
    const amount = el.firstElementChild ? el.firstElementChild.offsetWidth * 3 : el.offsetWidth * 0.7;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  return (
    <>
      <div className="bstore" aria-label={`${brandName} official store`}>
        <div className="bstore__brand">
          {brand?.logo && (
            <span className="bstore__logo"><img src={brand.logo} alt="" loading="lazy" /></span>
          )}
          <div className="bstore__name">
            <h2>{brandName}</h2>
            <span className="bstore__official"><BadgeCheck size={12} /> Official Store</span>
            <p>Official warranty & after-sales support on all appliances.</p>
          </div>
        </div>
        <Link to={`/brand/${BRAND_ID}`} className="bstore__cta">
          Visit Store <ChevronRight size={14} />
        </Link>
      </div>
      {items.length > 0 && (
        <div className="pgrid-wrap">
          <button className="pgrid-arrow pgrid-arrow--l" onClick={() => scroll(-1)} aria-label="Scroll left"><ChevronLeft size={16} /></button>
          <section className="pgrid pgrid--4" ref={ref} aria-label={`${brandName} products`}>
            {items.map((p) => <ProductCard key={p.sku} product={p} />)}
          </section>
          <button className="pgrid-arrow pgrid-arrow--r" onClick={() => scroll(1)} aria-label="Scroll right"><ChevronRight size={16} /></button>
        </div>
      )}
    </>
  );
}
