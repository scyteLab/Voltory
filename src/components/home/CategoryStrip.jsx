import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { CATEGORIES } from "../../data/products.js";

const IMG = {
  "refrigerators-freezers": "/products/sbs_ref.png",
  "air-conditioners": "/products/ac.png",
  "washing-machines": "/products/washing_machine.png",
  "televisions-audio": "/products/tv.png",
  "kitchen-appliances": "/products/blender.png",
  "small-appliances": "/products/cooker.png",
  "power-solutions": "/products/ups.png",
  "accessories": "/products/ups.png",
};

export default function CategoryStrip() {
  const ref = useRef(null);

  function scroll(dir) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.offsetWidth * 0.6, behavior: "smooth" });
  }

  return (
    <div className="cstrip-wrap">
      <button className="cstrip-arrow cstrip-arrow--l" onClick={() => scroll(-1)} aria-label="Scroll left">
        <ChevronLeft size={16} />
      </button>
      <div className="cstrip" ref={ref} aria-label="All categories">
        {CATEGORIES.map((c) => (
          <Link key={c.id} to={`/category/${c.id}`} className="cstrip__tile">
            <span className="cstrip__media"><img src={IMG[c.id]} alt="" loading="lazy" /></span>
            <span className="cstrip__label">{c.label}</span>
          </Link>
        ))}
        <Link to="/categories" className="cstrip__tile cstrip__tile--all">
          <span className="cstrip__media cstrip__media--all"><LayoutGrid size={26} /></span>
          <span className="cstrip__label">View All Categories</span>
        </Link>
      </div>
      <button className="cstrip-arrow cstrip-arrow--r" onClick={() => scroll(1)} aria-label="Scroll right">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}