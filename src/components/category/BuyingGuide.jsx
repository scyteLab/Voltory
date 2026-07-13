import { Link } from "react-router-dom";
import { AirVent, Home, Refrigerator } from "lucide-react";

/**
 * Buying guides per category. Add a new entry to the registry to
 * surface a guide on that category page. Returns null silently
 * for categories without a guide.
 */
const GUIDES = {
  "air-conditioners": {
    icon: AirVent,
    title: "Choose the Right HP/BTU for Your Space",
    sub: "Picking the right size saves energy and keeps you comfortable.",
    cta: "Find your perfect fit",
    cells: [
      { headline: "1.0 HP (9,000 BTU)", note: "Best for up to 12 m\u00B2" },
      { headline: "1.5 HP (12,000 BTU)", note: "Best for 12 \u2013 18 m\u00B2" },
      { headline: "2.0 HP (18,000 BTU)", note: "Best for 18 \u2013 25 m\u00B2" },
    ],
  },
  "refrigerators-freezers": {
    icon: Refrigerator,
    title: "Choose the Right Capacity for Your Household",
    sub: "Bigger families need more room \u2014 here's a rough guide.",
    cta: "See sizing tips",
    cells: [
      { headline: "150 \u2013 250 L", note: "Singles & small homes" },
      { headline: "300 \u2013 450 L", note: "Couples & small families" },
      { headline: "500 L+", note: "Large families & businesses" },
    ],
  },
};

export default function BuyingGuide({ categoryId }) {
  const g = GUIDES[categoryId];
  if (!g) return null;
  const I = g.icon;
  return (
    <section className="bguide" aria-label="Buying guide">
      <div className="bguide__head">
        <span className="bguide__icon"><I size={22} /></span>
        <div>
          <h2>{g.title}</h2>
          <p>{g.sub}</p>
          <Link to="/help" className="bguide__cta">{g.cta} \u2192</Link>
        </div>
      </div>
      <ul className="bguide__cells">
        {g.cells.map((c) => (
          <li key={c.headline}>
            <b>{c.headline}</b>
            <small>{c.note}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}