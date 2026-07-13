import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Global scroll restoration. Renders nothing; on every route change
 * it resets the window to the top — the expected behaviour when
 * navigating between pages on a content-driven site.
 *
 * Place once, inside <BrowserRouter>, above <Routes>.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}