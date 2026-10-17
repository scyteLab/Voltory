import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WINDOW_SIZE = 5;
const NARROW_WINDOW_SIZE = 3;
const NARROW_QUERY = "(max-width: 540px)";

/* Phones get a tighter window (‹ 1 … 19 20 21 … 40 ›) so the pager
   stays on one line instead of wrapping into rows of buttons. */
function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

/**
 * Builds a windowed page list: always shows the first and last page,
 * a sliding window of numbers around the current page, and "…" for
 * whatever's skipped. Keeps the control to ~7-9 buttons regardless
 * of how many pages exist.
 */
function buildPageList(current, total, windowSize = WINDOW_SIZE) {
  if (total <= windowSize + 2) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const half = Math.floor(windowSize / 2);
  let start = current - half;
  let end = current + half;

  if (start < 1) {
    end += 1 - start;
    start = 1;
  }
  if (end > total) {
    start -= end - total;
    end = total;
  }
  start = Math.max(start, 1);
  end = Math.min(end, total);

  const pages = [];
  if (start > 1) {
    pages.push(1);
    if (start > 2) pages.push("…");
  }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total) {
    if (end < total - 1) pages.push("…");
    pages.push(total);
  }
  return pages;
}

export default function Pagination({ page, totalPages, onChange, className = "cpager" }) {
  const narrow = useNarrow();
  if (totalPages <= 1) return null;

  const pages = buildPageList(page, totalPages, narrow ? NARROW_WINDOW_SIZE : WINDOW_SIZE);

  return (
    <nav className={className} aria-label="Pagination">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Previous page">
        <ChevronLeft size={14} /> <span className="cpager__label">Previous</span>
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`dots-${i}`} className="cpager__dots" aria-hidden="true">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={p === page ? "cpager__on" : ""}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}
      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Next page">
        <span className="cpager__label">Next</span> <ChevronRight size={14} />
      </button>
    </nav>
  );
}
