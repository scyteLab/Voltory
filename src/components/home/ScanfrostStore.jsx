import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, BadgeCheck } from "lucide-react";
import { byBrand, BRANDS } from "../../data/products.js";
import ProductCard from "../product/ProductCard.jsx";

export default function ScanfrostStore() {
  const brand = BRANDS.find((b) => b.id === "scanfrost");
  const products = byBrand("Scanfrost");
  const ref = useRef(null);

  function scroll(dir) {
    const el = ref.current;
    if (!el) return;
    const amount = el.firstElementChild ? el.firstElementChild.offsetWidth * 3 : el.offsetWidth * 0.7;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  return (
    <>
      <div className="bstore" aria-label="Scanfrost official store">
        <div className="bstore__brand">
          <span className="bstore__logo"><img src={brand.logo} alt="" loading="lazy" /></span>
          <div className="bstore__name">
            <h2>Scanfrost</h2>
            <span className="bstore__official"><BadgeCheck size={12} /> Official Store</span>
            <p>Official warranty & after-sales support on all appliances.</p>
          </div>
        </div>
        <Link to="/brand/scanfrost" className="bstore__cta">
          Visit Store <ChevronRight size={14} />
        </Link>
      </div>
      <div className="pgrid-wrap">
        <button className="pgrid-arrow pgrid-arrow--l" onClick={() => scroll(-1)} aria-label="Scroll left"><ChevronLeft size={16} /></button>
        <section className="pgrid pgrid--4" ref={ref} aria-label="Scanfrost products">
          {products.map((p) => <ProductCard key={p.sku} product={p} />)}
        </section>
        <button className="pgrid-arrow pgrid-arrow--r" onClick={() => scroll(1)} aria-label="Scroll right"><ChevronRight size={16} /></button>
      </div>
    </>
  );
}
