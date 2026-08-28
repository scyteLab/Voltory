import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Flame, ChevronLeft, ChevronRight } from "lucide-react";
import { getRecentSearches } from "../../utils/recentSearches.js";
import { search, searchUrl } from "../../utils/searchEngine.js";
import { naira, discountPct, stockState } from "../../utils/format.js";

/**
 * LastSearched — "Last Searched | <term>" homepage row, the piece
 * Jumia has and we didn't: recentSearches.js already tracked every
 * query (it feeds the search bar's dropdown), but nothing surfaced
 * that history back on the homepage. This does.
 *
 * The idea beyond copying Jumia: each term isn't a dead text pill.
 * We re-run the same client-side search() used by the search bar
 * against the CURRENT catalog snapshot and attach live signal —
 * today's price, and a "Now on sale" flag if that product has since
 * been discounted. A search someone gave up on last week becomes a
 * soft, honest nudge back ("still here, and now 15% off") instead of
 * just a memory of what they typed.
 */
export default function LastSearched() {
  const [terms, setTerms] = useState([]);
  const ref = useRef(null);

  useEffect(() => {
    setTerms(getRecentSearches());
  }, []);

  function scroll(dir) {
    const el = ref.current;
    if (!el) return;
    const amount = el.firstElementChild ? el.firstElementChild.offsetWidth * 3 : el.offsetWidth * 0.7;
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  }

  if (!terms.length) return null;

  return (
    <div className="lastsearch">
      <div className="section-head">
        <h2>Last Searched</h2>
      </div>
      <div className="lastsearch__wrap">
        <button className="pgrid-arrow pgrid-arrow--l" onClick={() => scroll(-1)} aria-label="Scroll left">
          <ChevronLeft size={16} />
        </button>
        <div className="lastsearch__row" ref={ref}>
          {terms.map((term) => (
            <LastSearchedCard key={term} term={term} />
          ))}
        </div>
        <button className="pgrid-arrow pgrid-arrow--r" onClick={() => scroll(1)} aria-label="Scroll right">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function LastSearchedCard({ term }) {
  const { products } = search(term, { maxProducts: 1 });
  const top = products[0] || null;
  const onSale = top && top.was && top.was > top.price;
  const out = top && stockState(top.stock) === "out";

  return (
    <Link to={searchUrl(term)} className="lastsearch__card">
      <span className="lastsearch__thumb">
        {top?.image ? <img src={top.image} alt="" /> : <Clock size={18} />}
        {onSale && (
          <span className="lastsearch__flag">
            <Flame size={10} /> {discountPct(top.price, top.was)}%
          </span>
        )}
      </span>
      <span className="lastsearch__term">{term}</span>
      {top ? (
        <span className="lastsearch__meta">
          {out ? "Out of stock" : `from ${naira(top.price)}`}
        </span>
      ) : (
        <span className="lastsearch__meta lastsearch__meta--muted">Search again</span>
      )}
    </Link>
  );
}
