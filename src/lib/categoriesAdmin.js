import { supabase } from "./supabaseClient.js";

/**
 * categoriesAdmin — CRUD wrapper for the `categories` table.
 * All calls assume authenticated admin (enforced by the existing
 * "admin write categories" RLS policy). Anon reads still work via
 * the public read policy — the storefront uses those.
 */

export async function fetchAllCategories() {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("label", { ascending: true });
    if (error) return { ok: false, error: error.message, categories: [] };
    return { ok: true, categories: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), categories: [] };
  }
}

/**
 * Slug validation: lowercase letters, digits, hyphens.
 * Length 2–40. Returns null if valid, error string otherwise.
 */
export function validateSlug(slug) {
  if (!slug) return "Slug is required";
  if (slug.length < 2 || slug.length > 40) return "Slug must be 2–40 characters";
  if (!/^[a-z0-9-]+$/.test(slug)) return "Slug can only contain lowercase letters, numbers, and hyphens";
  if (slug.startsWith("-") || slug.endsWith("-")) return "Slug can't start or end with a hyphen";
  return null;
}

/**
 * Create a new category. Returns { ok, category | error }.
 */
export async function createCategory(input) {
  const slugErr = validateSlug(input.id);
  if (slugErr) return { ok: false, error: slugErr };
  if (!input.label?.trim()) return { ok: false, error: "Label is required" };

  const row = {
    id: input.id.trim(),
    label: input.label.trim(),
    icon: input.icon || null,
    blurb: input.blurb?.trim() || null,
    hot: !!input.hot,
    filter_config: [],
    megamenu: [],
  };

  try {
    const { data, error } = await supabase
      .from("categories")
      .insert(row)
      .select()
      .single();
    if (error) {
      // Duplicate primary key — friendlier error
      if (error.code === "23505") {
        return { ok: false, error: `A category with slug "${row.id}" already exists.` };
      }
      // eslint-disable-next-line no-console
      console.error("[categories] create failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, category: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Update an existing category. `id` is the current PK; the other
 * fields are what we're updating (not the id itself — changing
 * a slug is a whole different operation since products FK to it).
 */
export async function updateCategory(id, patch) {
  if (!id) return { ok: false, error: "Missing category id" };
  if (patch.label !== undefined && !patch.label.trim()) {
    return { ok: false, error: "Label can't be empty" };
  }

  // Whitelist only the fields Tier 1 editor knows about
  const clean = {};
  if (patch.label !== undefined) clean.label = patch.label.trim();
  if (patch.icon !== undefined)  clean.icon  = patch.icon || null;
  if (patch.blurb !== undefined) clean.blurb = patch.blurb?.trim() || null;
  if (patch.hot !== undefined)   clean.hot   = !!patch.hot;

  if (!Object.keys(clean).length) return { ok: true };

  try {
    const { data, error } = await supabase
      .from("categories")
      .update(clean)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[categories] update failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, category: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Delete a category. Will fail cleanly if products still reference
 * it — that's the FK constraint doing its job.
 */
export async function deleteCategory(id) {
  if (!id) return { ok: false, error: "Missing category id" };
  try {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      // FK violation — category has products
      if (error.code === "23503") {
        return {
          ok: false,
          error: "This category has products linked to it. Reassign or delete those products first.",
        };
      }
      // eslint-disable-next-line no-console
      console.error("[categories] delete failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Count products per category. Used in the list view to warn
 * before deletion. Returns { [categoryId]: count }.
 */
export async function fetchCategoryProductCounts() {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("category")
      .not("category", "is", null);
    if (error) return { ok: false, error: error.message, counts: {} };
    const counts = {};
    for (const row of data || []) {
      counts[row.category] = (counts[row.category] || 0) + 1;
    }
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), counts: {} };
  }
}