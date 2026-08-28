import { supabase, supabaseConfigured } from "./supabaseClient.js";
import {
  PRODUCTS as FALLBACK_PRODUCTS,
  CATEGORIES as FALLBACK_CATEGORIES,
  BRANDS as FALLBACK_BRANDS,
} from "../data/products.js";

/**
 * catalogClient
 *
 * Storefront-facing loader used by CatalogContext. Reads the public
 * (anon-key, read-only) products/categories/brands tables and reshapes
 * rows into the exact shape src/data/products.js already exports, so
 * every page that migrated to useCatalog() needs no further changes.
 *
 * Falls back to the hardcoded arrays whenever Supabase isn't
 * configured or a query fails — the storefront must never go blank
 * just because the DB is unreachable.
 *
 * Session 2 fix: mapProduct now includes warranty_months and
 * energy_class, which had been silently dropped despite the admin
 * saving them. Without this fix, the warranty badge and energy
 * badge components never render on customer product pages.
 *
 * 2026-08-28 fix: mapProduct now includes gallery, which had been
 * silently dropped despite the admin uploading multiple images per
 * product. Without this fix, only the main image ever reached the
 * storefront PDP — all extra gallery URLs saved to DB were invisible
 * to customers, and the PDP fell back to sibling images (which was
 * itself a separate bug fixed the same session in Product.jsx).
 */

function mapCategory(row) {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    blurb: row.blurb,
    filterConfig: row.filter_config || [],
    hot: row.hot || false,
    megamenu: row.megamenu || [],
  };
}

function mapBrand(row) {
  return {
    id: row.id,
    name: row.name,
    logo: row.logo,
  };
}

function mapProduct(row) {
  return {
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    model: row.model,
    category: row.category,
    image: row.image,
    price: row.price,
    was: row.was,
    stock: row.stock,
    status: row.status,
    rating: row.rating,
    reviews: row.reviews,
    questions: row.questions,
    badge: row.badge,
    icon: row.icon,
    tags: row.tags || [],
    hp: row.hp,
    inverter: row.inverter,
    litres: row.litres,
    doors: row.doors,
    highlights: row.highlights || [],
    specs: row.specs || [],
    description: row.description,
    /* Session-1a fields — restored in Session 2 (were previously
       silently dropped here, hiding warranty badges + energy class
       on the customer product page) */
    warranty_months: row.warranty_months ?? null,
    energy_class:    row.energy_class    ?? null,
    /* Gallery — restored 2026-08-28. Admin's uploaded gallery URLs
       had been landing in DB correctly but never surfacing on the
       PDP because this mapper dropped the column. */
    gallery:         Array.isArray(row.gallery) ? row.gallery : [],
  };
}

function fallbackBundle(error) {
  return {
    products: FALLBACK_PRODUCTS,
    categories: FALLBACK_CATEGORIES,
    brands: FALLBACK_BRANDS,
    source: "fallback",
    error: error || null,
  };
}

export async function loadCatalog() {
  if (!supabaseConfigured) return fallbackBundle(null);

  try {
    const [productsRes, categoriesRes, brandsRes] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("categories").select("*"),
      supabase.from("brands").select("*"),
    ]);
    if (productsRes.error) throw productsRes.error;
    if (categoriesRes.error) throw categoriesRes.error;
    if (brandsRes.error) throw brandsRes.error;

    const products = (productsRes.data || []).map(mapProduct);
    const categories = (categoriesRes.data || []).map(mapCategory);
    const brands = (brandsRes.data || []).map(mapBrand);

    // An empty table set most likely means the DB hasn't been seeded
    // yet — prefer showing the demo catalog over an empty storefront.
    if (!products.length && !categories.length && !brands.length) {
      return fallbackBundle(null);
    }

    return { products, categories, brands, source: "supabase", error: null };
  } catch (err) {
    return fallbackBundle(err?.message || String(err));
  }
}