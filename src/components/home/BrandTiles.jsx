import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCatalog } from "../../context/CatalogContext.jsx";

/**
 * Shop By Top Brands \u2014 horizontal scrollable strip of brand logos.
 *
 * Was previously inline in Home.jsx. Extracted so it can be
 * reordered / hidden via site_sections. Title is configurable;
 * defaults preserve the current copy.
 */
export default function BrandTiles({ config = {} }) {
  const { brands } = useCatalog();
  const ref = useRef(null);

  const title = config.title || "Shop By Top Brands";
  const linkText = config.link_text || "View all brands";

  function scrollSlider(dir) {
    const el = ref.current;
    if (!el) return;
    const amount = el.firstElementChild
      ? el.firstElementChild.offsetWidth * 3
      : el.offsetWidth * 0.7;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  if (!brands || brands.length === 0) return null;

  return (
    <>
      <div className="section-head reveal reveal--3">
        <h2>{title}</h2>
        <Link to="/brands">{linkText} <ChevronRight size={14} /></Link>
      </div>
      <div className="brands-wrap">
        <button
          className="brands-arrow brands-arrow--l"
          onClick={() => scrollSlider(-1)}
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} />
        </button>
        <section className="brands-strip" ref={ref} aria-label="Brands">
          {brands.map((b) => (
            <Link
              key={b.id}
              to={`/brand/${b.id}`}
              className="brand-tile"
              aria-label={b.name}
            >
              {b.logo && <img src={b.logo} alt={b.name} loading="lazy" />}
            </Link>
          ))}
        </section>
        <button
          className="brands-arrow brands-arrow--r"
          onClick={() => scrollSlider(1)}
          aria-label="Scroll right"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </>
  );
}