import { useEffect } from "react";
import { SITE } from "../config/site.js";
import HomeRenderer from "../components/home/HomeRenderer.jsx";

/**
 * Home \u2014 the storefront landing page.
 *
 * As of Session 31, the homepage layout is data-driven: it reads its
 * sections and their config from the `site_sections` table via
 * SiteSectionsContext, and HomeRenderer maps each row to a component.
 *
 * The visual output is intentionally identical to the pre-Session-31
 * hardcoded homepage \u2014 all we've done is move the layout definition
 * out of code and into data. Session 31b adds the admin UI to
 * rearrange, hide, and edit sections.
 */
export default function Home() {
  useEffect(() => {
    const prev = document.title;
    document.title = SITE.name;
    return () => { document.title = prev; };
  }, []);

  return <HomeRenderer />;
}