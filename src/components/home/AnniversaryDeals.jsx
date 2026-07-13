import { useRef } from "react";
import { PartyPopper, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { getDeals } from "../../data/products.js";
import ProductCard from "../product/ProductCard.jsx";
import CountdownTimer from "./CountdownTimer.jsx";

export default function AnniversaryDeals() {
  const picks = getDeals().slice().reverse().slice(0, 10);
  const ref = useRef(null);

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
          <span className="anniv__badge"><PartyPopper size={13} /> Voltory Anniversary Sale</span>
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
      <div className="pgrid-wrap">
        <button className="pgrid-arrow pgrid-arrow--l" onClick={() => scroll(-1)} aria-label="Scroll left"><ChevronLeft size={16} /></button>
        <section className="pgrid" ref={ref} aria-label="Anniversary deals">
          {picks.map((p) => <ProductCard key={p.sku} product={p} />)}
        </section>
        <button className="pgrid-arrow pgrid-arrow--r" onClick={() => scroll(1)} aria-label="Scroll right"><ChevronRight size={16} /></button>
      </div>
    </>
  );
}
