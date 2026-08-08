import { supabase } from "./supabaseClient.js";

/**
 * siteSectionsAdmin
 *
 * Write layer for the /admin/homepage page. Every function assumes
 * the caller is an authenticated admin \u2014 the RLS policy
 * "admin write site_sections" enforces this at the DB layer, so
 * anonymous callers get a permission error.
 *
 * All functions return { ok: true, ... } on success or
 * { ok: false, error } on failure. None throw.
 */

/**
 * Fetch every section including hidden ones. Storefront uses
 * loadSiteSections() which filters to visible; the admin needs
 * the full list to render toggles.
 */
export async function fetchAllSectionsForAdmin() {
  try {
    const { data, error } = await supabase
      .from("site_sections")
      .select("*")
      .order("position", { ascending: true });
    if (error) return { ok: false, error: error.message, sections: [] };
    return { ok: true, sections: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err), sections: [] };
  }
}

/**
 * Persist the new order after a drag-drop. Expects an ordered array
 * of section IDs; assigns positions 10, 20, 30... so future inserts
 * can slot cleanly between existing sections.
 *
 * Uses individual UPDATE calls rather than upsert. Upsert with
 * partial rows would fail the `kind NOT NULL` constraint on the
 * INSERT branch, silently rolling back the reorder client-side.
 * Individual updates are correct and fast enough for 10-30 sections.
 */
export async function reorderSections(orderedIds) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, error: "No ids to reorder" };
  }
  try {
    // Kick off all updates in parallel and collect any failures
    const results = await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from("site_sections")
          .update({ position: (i + 1) * 10 })
          .eq("id", id)
      )
    );
    const firstErr = results.find((r) => r.error);
    if (firstErr) {
      // eslint-disable-next-line no-console
      console.error("[siteSections] reorder failed:", firstErr.error);
      return { ok: false, error: firstErr.error.message };
    }
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[siteSections] reorder threw:", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Toggle the visibility of one section.
 */
export async function setSectionVisibility(id, isVisible) {
  try {
    const { error } = await supabase
      .from("site_sections")
      .update({ is_visible: !!isVisible })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Merge patch into a section's `config` JSONB. Reads the existing
 * config, spreads the patch on top, writes back. Small race window
 * if two admins edit the same section simultaneously; acceptable
 * at our scale (single-operator ecommerce).
 */
export async function patchSectionConfig(id, patch) {
  try {
    const { data: existing, error: getErr } = await supabase
      .from("site_sections")
      .select("config")
      .eq("id", id)
      .single();
    if (getErr) {
      // eslint-disable-next-line no-console
      console.error("[siteSections] patchConfig read failed:", getErr);
      return { ok: false, error: getErr.message };
    }
    const nextConfig = { ...(existing?.config || {}), ...patch };
    const { error } = await supabase
      .from("site_sections")
      .update({ config: nextConfig })
      .eq("id", id);
    if (error) {
      // eslint-disable-next-line no-console
      console.error("[siteSections] patchConfig write failed:", error, "id:", id, "patch:", patch);
      return { ok: false, error: error.message };
    }
    return { ok: true, config: nextConfig };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[siteSections] patchConfig threw:", err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Add a new section to the homepage. Places it at the end
 * (max existing position + 10).
 */
export async function addSection({ kind, config = {} }) {
  try {
    // Find current max position
    const { data: maxRows, error: mxErr } = await supabase
      .from("site_sections")
      .select("position")
      .order("position", { ascending: false })
      .limit(1);
    if (mxErr) return { ok: false, error: mxErr.message };
    const nextPos = ((maxRows?.[0]?.position || 0) + 10);

    const { data, error } = await supabase
      .from("site_sections")
      .insert({ kind, position: nextPos, is_visible: true, config })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, section: data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Delete a section outright. The admin UI wraps this in a confirm
 * dialog since it's destructive.
 */
export async function deleteSection(id) {
  try {
    const { error } = await supabase
      .from("site_sections")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}