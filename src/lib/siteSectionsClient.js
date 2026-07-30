import { supabase, supabaseConfigured } from "./supabaseClient.js";

/**
 * siteSectionsClient
 *
 * Loads the homepage layout from Supabase. If Supabase is unreachable
 * or the table is empty (fresh project without the seed run), we fall
 * back to a hardcoded layout that matches Home.jsx's original order.
 * The storefront never shows a blank homepage.
 */

/**
 * Fallback layout \u2014 matches the original hardcoded Home.jsx order.
 * Used when Supabase is unreachable OR the site_sections table is
 * empty. Same shape as a real DB row so consumers stay ignorant of
 * the source.
 */
const FALLBACK_SECTIONS = [
  { kind: "category_sidebar",   position: 10,  is_visible: true, config: {} },
  { kind: "hero",               position: 20,  is_visible: true, config: {} },
  {
    kind: "hero_promo_tiles",   position: 30,  is_visible: true,
    config: {
      tiles: [
        {
          kind: "warm",
          title: "Anniversary Deals",
          subtitle: "Save up to 30% on selected appliances",
          cta: "Shop now",
          href: "/deals",
        },
        {
          kind: "cool",
          title: "Beat the Heat",
          subtitle: "Inverter ACs on sale",
          cta: "Browse ACs",
          href: "/category/air-conditioners",
        },
      ],
    },
  },
  { kind: "brand_tiles",        position: 40,  is_visible: true, config: { title: "Shop by brand" } },
  { kind: "scanfrost_store",    position: 50,  is_visible: true, config: {} },
  {
    kind: "deals_row",          position: 60,  is_visible: true,
    config: { title: "Deals of the day", show_countdown: true, source: "auto", limit: 10 },
  },
  { kind: "anniversary_deals",  position: 70,  is_visible: true, config: {} },
  { kind: "category_strip",     position: 80,  is_visible: true, config: {} },
  {
    kind: "featured_row",       position: 90,  is_visible: true,
    config: { title: "Recommended products", source: "auto", limit: 10 },
  },
  { kind: "last_viewed",        position: 100, is_visible: true, config: {} },
  { kind: "service_cards",      position: 110, is_visible: true, config: {} },
  { kind: "app_promo",          position: 120, is_visible: true, config: {} },
  { kind: "bottom_benefits",    position: 130, is_visible: true, config: {} },
];

/**
 * Fetch the homepage layout, ordered by position ascending.
 * Returns { sections, source, error }. `sections` always includes
 * only visible sections (invisible ones are filtered out here so
 * the renderer stays simple).
 *
 * `source` is "supabase" | "fallback", useful for a dev banner.
 */
export async function loadSiteSections() {
  if (!supabaseConfigured) {
    return { sections: FALLBACK_SECTIONS, source: "fallback", error: null };
  }
  try {
    const { data, error } = await supabase
      .from("site_sections")
      .select("*")
      .order("position", { ascending: true });

    if (error) {
      return { sections: FALLBACK_SECTIONS, source: "fallback", error: error.message };
    }
    if (!data || data.length === 0) {
      return { sections: FALLBACK_SECTIONS, source: "fallback", error: null };
    }
    // Filter to visible only \u2014 admin can still see hidden sections
    // via the admin page (Session 31b) using a separate fetcher.
    const visible = data.filter((s) => s.is_visible);
    return { sections: visible, source: "supabase", error: null };
  } catch (err) {
    return { sections: FALLBACK_SECTIONS, source: "fallback", error: err?.message || String(err) };
  }
}