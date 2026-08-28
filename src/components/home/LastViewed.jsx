import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { bySku } from "../../data/products.js";
import { getRecentlyViewed } from "../../utils/recentlyViewed.js";
import ProductCard from "../product/ProductCard.jsx";

/**
 * LastViewed — "Recently Viewed" homepage row.
 *
 * Only ever shows products the visitor actually looked at (via
 * recentlyViewed.js, written from Product.jsx on every product page
 * visit). No fallback/sample SKUs — a brand-new visitor with no
 * browsing history yet gets nothing here at all, not a fake "recently
 * viewed" row of products they never opened.
 */
export default function LastViewed() {
  const [skus, setSkus] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    setSkus(getRecentlyViewed());
  }, []);

  function scroll(dir) {
    const el = ref.current;
    if (!el) return;
    const amount = el.firstElementChild ? el.firstElementChild.offsetWidth * 3 : el.offsetWidth * 0.7;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  const products = skus.map(bySku).filter(Boolean).slice(0, 10);
  if (!products.length) return null;

  return (
    <div className="lastviewed">
      <div className="section-head">
        <h2>Recently Viewed</h2>
      </div>
      <div className="pgrid-wrap">
        <button className="pgrid-arrow pgrid-arrow--l" onClick={() => scroll(-1)} aria-label="Scroll left"><ChevronLeft size={16} /></button>
        <section className="pgrid" ref={ref} aria-label="Recently viewed products">
          {products.map((p) => <ProductCard key={p.sku} product={p} />)}
        </section>
        <button className="pgrid-arrow pgrid-arrow--r" onClick={() => scroll(1)} aria-label="Scroll right"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
