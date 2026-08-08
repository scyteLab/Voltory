import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { CATEGORIES } from "../../data/products.js";
import Icon from "../ui/Icon.jsx";

export default function CategorySidebar() {
  const [active, setActive] = useState(null);
  const closeTimer = useRef(null);

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

  return (
    <aside
      className="catsidebar"
      aria-label="Shop by Categories"
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
            {active === c.id && c.megamenu && (
              <div
                className="megamenu"
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                {c.megamenu.map((col) => (
                  <div className="megamenu__col" key={col.heading}>
                    <h4>{col.heading}</h4>
                    <ul>
                      {col.items.map((item) => (
                        <li key={item}>
                          <Link
                            to={`/category/${c.id}?q=${encodeURIComponent(item)}`}
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
            )}
          </li>
        ))}
        <li>
          <Link to="/categories" className="catsidebar__link catsidebar__link--all">
            <LayoutGrid size={15} className="catsidebar__icon" />
            <span>All Categories</span>
          </Link>
        </li>
      </ul>
    </aside>
  );
}
