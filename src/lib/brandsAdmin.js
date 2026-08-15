import { supabase } from "./supabaseClient.js";

/**
 * brandsAdmin — CRUD wrapper for the `brands` table.
 *
 * Schema:  id (text PK), name (text NOT NULL), logo (text nullable)
 *
 * Important quirk about the brands table:
 *   · products.brand references brand.name (not brand.id)
 *   · URLs use /brand/:id (the slug)
 *
 * That means BOTH id and name have downstream references and are
 * dangerous to change after creation:
 *   · Renaming id → breaks bookmarked URLs
 *   · Renaming name → orphans products (they'd no longer match)
 *
 * So the modal locks both id and name in edit mode. Only the logo
 * can be updated post-creation via the current editor.
 */

export async function fetchAllBrands() {
  try {
    const { data, error } = await supabase
      .from("brands")
      .select("*")
      .order("name", { ascending: true });
    if (error) return { ok: false, error: error.message, brands: [] };
    return { ok: true, brands: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), brands: [] };
  }
}

/**
 * Slug validation: lowercase letters, digits, hyphens.
 * Length 2–40. Returns null if valid, error string otherwise.
 */
export function validateBrandSlug(slug) {
  if (!slug) return "Slug is required";
  if (slug.length < 2 || slug.length > 40) return "Slug must be 2–40 characters";
  if (!/^[a-z0-9-]+$/.test(slug)) return "Slug can only contain lowercase letters, numbers, and hyphens";
  if (slug.startsWith("-") || slug.endsWith("-")) return "Slug can't start or end with a hyphen";
  return null;
}

/**
 * Create a new brand.
 * We check name uniqueness client-side too because products link by
 * name and having two brands with the same name would create ambiguity.
 * (The DB itself doesn't enforce this since name isn't UNIQUE.)
 */
export async function createBrand(input, existingBrands = []) {
  const slugErr = validateBrandSlug(input.id);
  if (slugErr) return { ok: false, error: slugErr };
  if (!input.name?.trim()) return { ok: false, error: "Brand name is required" };

  const name = input.name.trim();
  const dup = existingBrands.find(
    (b) => b.name.toLowerCase() === name.toLowerCase()
  );
  if (dup) {
    return { ok: false, error: `A brand named "${dup.name}" already exists (slug: ${dup.id}).` };
  }

  const row = {
    id: input.id.trim(),
    name,
    logo: input.logo?.trim() || null,
  };

  try {
    const { data, error } = await supabase
      .from("brands")
      .insert(row)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: `A brand with slug "${row.id}" already exists.` };
      }
      // eslint-disable-next-line no-console
      console.error("[brands] create failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, brand: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Update a brand. Tier 1 lets only `logo` change; name and id are
 * locked because renaming either would break existing references.
 */
export async function updateBrand(id, patch) {
  if (!id) return { ok: false, error: "Missing brand id" };

  const clean = {};
  if (patch.logo !== undefined) clean.logo = patch.logo?.trim() || null;

  if (!Object.keys(clean).length) return { ok: true };

  try {
    const { data, error } = await supabase
      .from("brands")
      .update(clean)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[brands] update failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, brand: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Delete a brand. Products link by `name`, not `id`, so there's no
 * FK constraint stopping deletion. That means we have to guard
 * against it ourselves — refuse deletion if any products still
 * reference the brand by name.
 */
export async function deleteBrand(brand) {
  if (!brand?.id) return { ok: false, error: "Missing brand" };

  // Check for linked products first — by name, since that's how they link
  try {
    const { count, error: cntErr } = await supabase
      .from("products")
      .select("sku", { count: "exact", head: true })
      .eq("brand", brand.name);
    if (cntErr) return { ok: false, error: cntErr.message };

    if (count && count > 0) {
      return {
        ok: false,
        error: `"${brand.name}" has ${count} product${count === 1 ? "" : "s"} linked to it. Reassign or delete those products first.`,
      };
    }

    const { error } = await supabase.from("brands").delete().eq("id", brand.id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[brands] delete failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Count products per brand. Uses `brand` column (which is the name).
 * Returns { [brandName]: count }.
 */
export async function fetchBrandProductCounts() {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("brand")
      .not("brand", "is", null);
    if (error) return { ok: false, error: error.message, counts: {} };
    const counts = {};
    for (const row of data || []) {
      counts[row.brand] = (counts[row.brand] || 0) + 1;
    }
    return { ok: true, counts };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), counts: {} };
  }
}