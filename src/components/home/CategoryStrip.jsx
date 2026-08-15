import { useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { useCatalog } from "../../context/CatalogContext.jsx";
import Icon from "../ui/Icon.jsx";

/**
 * CategoryStrip — horizontal scrollable strip of categories with tile
 * images (or icon fallback when no image is registered).
 *
 * Reads categories from useCatalog() so new categories added via the
 * admin appear automatically. Image resolution is a two-tier fallback:
 *   1. Curated tile image from the hardcoded IMG map (for the seeded
 *      categories — keeps their nice product photography)
 *   2. Icon on a coloured square (for any category not in the map)
 *
 * Later, when we add an image_url field to the categories table
 * (Session 33 material), we'll swap the IMG map for that column and
 * this fallback becomes the pure default.
 */

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
  const { categories: CATEGORIES } = useCatalog();
  const ref = useRef(null);

  function scroll(dir) {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.firstElementChild?.offsetWidth || 200) * 3, behavior: "smooth" });
  }

  return (
    <>
      <div className="section-head">
        <h2>Shop by category</h2>
        <Link to="/categories" className="section-head__link">
          View all <LayoutGrid size={13} />
        </Link>
      </div>
      <div className="cstrip-wrap">
        <button className="cstrip-arrow cstrip-arrow--l" onClick={() => scroll(-1)} aria-label="Scroll left">
          <ChevronLeft size={18} />
        </button>
        <div className="cstrip" ref={ref}>
          {CATEGORIES.map((c) => (
            <Link key={c.id} to={`/category/${c.id}`} className="cstrip__tile">
              <span className="cstrip__media">
                {IMG[c.id] ? (
                  <img src={IMG[c.id]} alt="" loading="lazy" />
                ) : (
                  <span className="cstrip__media-fb">
                    <Icon name={c.icon || "Package"} size={32} />
                  </span>
                )}
              </span>
              <span className="cstrip__label">{c.label}</span>
            </Link>
          ))}
        </div>
        <button className="cstrip-arrow cstrip-arrow--r" onClick={() => scroll(1)} aria-label="Scroll right">
          <ChevronRight size={18} />
        </button>
      </div>
    </>
  );
}