import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

/**
 * Compact brand filter chips shown above the product grid.
 * Reads/writes the same URL brand filter as the sidebar; this
 * component only renders and reports clicks.
 *
 *   options  — [{ slug, name, brand, count }] (most products first)
 *   selected — array of selected slugs
 *   onToggle(slug), onClear()
 */
export default function BrandChips({ options, selected, onToggle, onClear }) {
  const rowRef = useRef(null);
  const none = selected.length === 0;

  /* Keep the first selected chip in view on narrow screens, where
     the row scrolls sideways. Scrolls the row only, never the page. */
  const firstSelected = options.find((o) => selected.includes(o.slug))?.slug;
  useEffect(() => {
    const row = rowRef.current;
    if (!row || !firstSelected) return;
    const chip = row.querySelector(`[data-slug="${CSS.escape(firstSelected)}"]`);
    if (!chip) return;
    const left = chip.offsetLeft, right = left + chip.offsetWidth;
    if (left < row.scrollLeft || right > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    }
  }, [firstSelected]);

  return (
    <div className="cbchips" role="group" aria-label="Filter by brand" ref={rowRef}>
      <button
        type="button"
        className={"cbchip" + (none ? " cbchip--on" : "")}
        aria-pressed={none}
        onClick={onClear}
      >
        {none && <Check size={14} aria-hidden="true" />}
        All brands
      </button>
      {options.map((o) => {
        const on = selected.includes(o.slug);
        return (
          <button
            key={o.slug}
            type="button"
            data-slug={o.slug}
            className={"cbchip" + (on ? " cbchip--on" : "")}
            aria-pressed={on}
            onClick={() => onToggle(o.slug)}
          >
            {on
              ? <Check size={14} aria-hidden="true" />
              : o.brand.logo && <img className="cbchip__logo" src={o.brand.logo} alt="" loading="lazy" />}
            {o.name} <span className="cbchip__count">({o.count})</span>
          </button>
        );
      })}
    </div>
  );
}
