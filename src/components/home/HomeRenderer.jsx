import { useSiteSections } from "../../context/SiteSectionsContext.jsx";
import CategorySidebar from "./CategorySidebar.jsx";
import Hero from "./Hero.jsx";
import HeroPromoTiles from "./HeroPromoTiles.jsx";
import BrandTiles from "./BrandTiles.jsx";
import ScanfrostStore from "./ScanfrostStore.jsx";
import ProductRowSection from "./ProductRowSection.jsx";
import AnniversaryDeals from "./AnniversaryDeals.jsx";
import CategoryStrip from "./CategoryStrip.jsx";
import LastViewed from "./LastViewed.jsx";
import ServiceCards from "./ServiceCards.jsx";
import AppPromo from "./AppPromo.jsx";
import BottomBenefits from "./BottomBenefits.jsx";

/**
 * HomeRenderer
 *
 * The homepage render engine. Reads the list of visible sections
 * from SiteSectionsContext and renders each one via a component
 * lookup keyed on `kind`.
 *
 * Adding a new section type in the future:
 *   1. Add its `kind` string to the CHECK constraint in site_sections.sql
 *   2. Build the component (accepts `config` prop)
 *   3. Register it in the SECTIONS map below
 *
 * If a kind isn't in the map, that section is silently skipped —
 * safer than crashing when we add a new kind server-side before the
 * client bundle catches up.
 */

/** kind → component */
const SECTIONS = {
  category_sidebar:  CategorySidebar,
  hero:              Hero,
  hero_promo_tiles:  HeroPromoTiles,
  brand_tiles:       BrandTiles,
  scanfrost_store:   ScanfrostStore,
  deals_row:         ProductRowSection,
  anniversary_deals: AnniversaryDeals,
  category_strip:    CategoryStrip,
  featured_row:      ProductRowSection,
  last_viewed:       LastViewed,
  service_cards:     ServiceCards,
  app_promo:         AppPromo,
  bottom_benefits:   BottomBenefits,
  // promo_banner: PromoBanner — lands with Session 31b when we build the admin UI
};

/**
 * Sections that render inside the .wrap container. A few (like the
 * hero row and bottom benefits strip) span full width and should
 * live outside. We keep the same structural decisions the original
 * Home.jsx made — just data-driven now.
 */
const FULL_WIDTH_KINDS = new Set(["bottom_benefits"]);

/**
 * Kinds that appear side-by-side inside the hero row (top of page).
 * The original Home.jsx wrapped these in a single grid; we detect
 * a contiguous run of these kinds at the top and group them.
 */
const HERO_ROW_KINDS = new Set(["category_sidebar", "hero", "hero_promo_tiles"]);

export default function HomeRenderer() {
  const { sections, loading } = useSiteSections();

  if (loading && sections.length === 0) {
    // Empty first paint — avoids a flash of "nothing". Better than
    // showing a spinner because in normal use the fallback data
    // resolves so fast this branch never triggers.
    return null;
  }

  // Split sections into: hero row group, main wrap content, full-width tail.
  const heroRun = [];
  const mainRun = [];
  const tailRun = [];
  let inHero = true;

  for (const s of sections) {
    if (inHero && HERO_ROW_KINDS.has(s.kind)) {
      heroRun.push(s);
    } else if (FULL_WIDTH_KINDS.has(s.kind)) {
      inHero = false;
      tailRun.push(s);
    } else {
      inHero = false;
      mainRun.push(s);
    }
  }

  return (
    <main className="home">
      {heroRun.length > 0 && (
        <div className="wrap hero-row">
          {heroRun.map((s) => renderSection(s))}
        </div>
      )}

      {mainRun.length > 0 && (
        <div className="wrap">
          {mainRun.map((s) => renderSection(s))}
        </div>
      )}

      {tailRun.map((s) => renderSection(s))}
    </main>
  );
}

function renderSection(section) {
  const Comp = SECTIONS[section.kind];
  if (!Comp) return null;
  return <Comp key={section.id || section.kind + section.position} config={section.config || {}} sectionKind={section.kind} />;
}