import { supabase } from "./supabaseClient.js";

/**
 * inventoryClient — read-only queries for the Inventory section.
 *
 * We fetch a minimal projection (no images, no description, no
 * long text fields) because inventory pages are dense lists and
 * we want them fast.
 */

/** Threshold below which a product counts as "low stock." */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Load every active product with the fields the inventory page
 * needs. Ordered by stock ascending so the most urgent problems
 * come first.
 */
export async function fetchInventoryRows() {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("sku, name, brand, category, stock, status, price")
      .eq("status", "active")
      .order("stock", { ascending: true });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("[inventory] fetch failed:", error);
      return { ok: false, error: error.message, rows: [] };
    }

    const rows = (data || []).map((r) => ({
      sku: r.sku,
      name: r.name,
      brand: r.brand,
      categoryId: r.category,
      stock: Number(r.stock) || 0,
      price: Number(r.price) || 0,
      status: stockStatus(Number(r.stock) || 0),
    }));

    return { ok: true, rows };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), rows: [] };
  }
}

/** Classify stock into a status label. */
export function stockStatus(stock) {
  if (stock <= 0) return "out";
  if (stock < LOW_STOCK_THRESHOLD) return "low";
  return "ok";
}