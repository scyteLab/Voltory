import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { CATEGORIES } from "../../data/products.js";
import { allMegaMenuImages } from "../../config/megaMenuMedia.js";
import Icon from "../ui/Icon.jsx";
import MegaMenuFeature from "./MegaMenuFeature.jsx";

export default function CategorySidebar() {
  const [active, setActive] = useState(null);
  const [failedImages, setFailedImages] = useState(() => new Set());
  const closeTimer = useRef(null);
  const preloaded = useRef(false);

  const markFailed = useCallback((src) => {
    setFailedImages((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
  }, []);

  /* Warm the browser cache with every feature image the first time the
     pointer enters the sidebar, so the panel and its crossfade are ready
     by the time a category opens. Missing files are recorded here and
     their panels never show. */
  const preload = useCallback(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    for (const src of allMegaMenuImages()) {
      const img = new Image();
      img.onerror = () => markFailed(src);
      img.src = src;
    }
  }, [markFailed]);

  const open = useCallback((id) => {
    clearTimeout(closeTimer.current);
    setActive(id);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setActive(null), 400);
  }, []);

  const cancelClose = useCallback(() => {
    clearTimeout(closeTimer.current);
  }, []);

  const activeCat = CATEGORIES.find((c) => c.id === active);

  return (
    <aside
      className="catsidebar"
      aria-label="Shop by Categories"
      onMouseEnter={preload}
      onMouseLeave={scheduleClose}
    >
      <Link to="/categories" className="catsidebar__head">
        <LayoutGrid size={16} /> Shop by Categories
      </Link>
      <ul className="catsidebar__list">
        {CATEGORIES.map((c) => (
          <li key={c.id} onMouseEnter={() => open(c.id)}>
            <Link to={`/category/${c.id}`} className={"catsidebar__link" + (active === c.id ? " catsidebar__link--active" : "")}>
              <Icon name={c.icon} size={15} className="catsidebar__icon" />
              <span>{c.label}</span>
              {c.hot && <span className="catsidebar__hot">Hot</span>}
              {c.megamenu && <ChevronRight size={12} className="catsidebar__arrow" />}
            </Link>
          </li>
        ))}
        <li>
          <Link to="/categories" className="catsidebar__link catsidebar__link--all">
            <LayoutGrid size={15} className="catsidebar__icon" />
            <span>All Categories</span>
          </Link>
        </li>
      </ul>

      {/* One flyout for all categories (rather than one per <li>) so it
          stays mounted while moving between them — that's what lets the
          feature image crossfade. */}
      {activeCat?.megamenu && (
        <div
          className="megamenu"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="megamenu__cols">
            {activeCat.megamenu.map((col) => (
              <div className="megamenu__col" key={col.heading}>
                <h4>{col.heading}</h4>
                <ul>
                  {col.items.map((item) => (
                    <li key={item}>
                      <Link
                        to={`/category/${activeCat.id}?q=${encodeURIComponent(item)}`}
                        onClick={() => setActive(null)}
                      >
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <MegaMenuFeature
            categoryId={activeCat.id}
            failed={failedImages}
            onImageError={markFailed}
            onNavigate={() => setActive(null)}
          />
        </div>
      )}
    </aside>
  );
}
