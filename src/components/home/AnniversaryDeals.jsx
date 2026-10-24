import { useMemo, useRef } from "react";
import { PartyPopper, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { discountPct } from "../../utils/format.js";
import ProductCard from "../product/ProductCard.jsx";
import CountdownTimer from "./CountdownTimer.jsx";

const LIMIT = 10;

/**
 * Anniversary sale banner + a row of the deepest in-stock discounts.
 *
 * Reads the live catalogue (it used to read the static data/products.js
 * list, which is empty since the move to Supabase — so only the row's
 * scroll arrows ever rendered). The row is omitted when there are no
 * discounted products, so no orphan arrows.
 */
export default function AnniversaryDeals() {
  const { products } = useCatalog();
  const ref = useRef(null);

  const picks = useMemo(() => (
    products
      .filter((p) => p.was > p.price && p.stock > 0 && p.status !== "inactive")
      .sort((a, b) => discountPct(b.price, b.was) - discountPct(a.price, a.was))
      .slice(0, LIMIT)
  ), [products]);

  function scroll(dir) {
    const el = ref.current;
    if (!el) return;
    const amount = el.firstElementChild ? el.firstElementChild.offsetWidth * 3 : el.offsetWidth * 0.7;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  return (
    <>
      <div className="anniv" aria-label="Anniversary sale">
        <div>
          <span className="anniv__badge"><PartyPopper size={13} /> NAVEN Anniversary Sale</span>
          <h2>Up to 40% Off — Celebrate With Us</h2>
          <p>Our biggest discounts of the year on appliances you actually need.</p>
        </div>
        <div className="anniv__right">
          <CountdownTimer />
          <Link to="/deals" className="anniv__cta">
            Shop Anniversary Deals <ChevronRight size={14} style={{ verticalAlign: "middle" }} />
          </Link>
        </div>
      </div>
      {picks.length > 0 && (
        <div className="pgrid-wrap">
          <button className="pgrid-arrow pgrid-arrow--l" onClick={() => scroll(-1)} aria-label="Scroll left"><ChevronLeft size={16} /></button>
          <section className="pgrid" ref={ref} aria-label="Anniversary deals">
            {picks.map((p) => <ProductCard key={p.sku} product={p} />)}
          </section>
          <button className="pgrid-arrow pgrid-arrow--r" onClick={() => scroll(1)} aria-label="Scroll right"><ChevronRight size={16} /></button>
        </div>
      )}
    </>
  );
}
