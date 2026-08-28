import { supabase } from "./supabaseClient.js";

/**
 * attributesClient  —  Session 1 API
 *
 * Full CRUD for attribute definitions, their allowed values,
 * and category mappings. Session 2 will add product ↔ value
 * assignment; Session 3 will add filter query helpers.
 *
 * Public API:
 *   fetchAllAttributes()              — list all, ordered by position
 *   fetchAttributeById(id)            — with values + category ids
 *   createAttribute(payload)
 *   updateAttribute(id, patch)
 *   deleteAttribute(id)               — cascades to values + mappings
 *   setAttributeValues(id, values[])  — replace value set atomically
 *   setAttributeCategories(id, ids[]) — replace category mapping
 *   fetchCategoriesList()             — for category multi-select UI
 *
 * All functions return { ok, data?, error? } to match the
 * conventions used across the codebase.
 */

/* ============================================================
   FETCH
   ============================================================ */

export async function fetchAllAttributes() {
  try {
    const { data: attrs, error } = await supabase
      .from("attributes")
      .select("*")
      .order("position", { ascending: true })
      .order("name",     { ascending: true });
    if (error) return { ok: false, error: error.message };

    /* Fetch counts of values + categories per attribute in bulk */
    const [{ data: valCounts }, { data: catCounts }] = await Promise.all([
      supabase.from("attribute_values").select("attribute_id"),
      supabase.from("category_attributes").select("attribute_id"),
    ]);

    const valMap = new Map();
    for (const row of valCounts || []) {
      valMap.set(row.attribute_id, (valMap.get(row.attribute_id) || 0) + 1);
    }
    const catMap = new Map();
    for (const row of catCounts || []) {
      catMap.set(row.attribute_id, (catMap.get(row.attribute_id) || 0) + 1);
    }

    const enriched = (attrs || []).map((a) => ({
      ...a,
      value_count:    valMap.get(a.id) || 0,
      category_count: catMap.get(a.id) || 0,
    }));

    return { ok: true, data: enriched };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function fetchAttributeById(id) {
  if (!id) return { ok: false, error: "Attribute id is required." };

  try {
    const [attrRes, valuesRes, catsRes] = await Promise.all([
      supabase.from("attributes").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("attribute_values")
        .select("*")
        .eq("attribute_id", id)
        .order("position"),
      supabase
        .from("category_attributes")
        .select("category_id")
        .eq("attribute_id", id),
    ]);

    if (attrRes.error) return { ok: false, error: attrRes.error.message };
    if (!attrRes.data) return { ok: false, error: "Attribute not found." };

    return {
      ok: true,
      data: {
        attribute:  attrRes.data,
        values:     valuesRes.data || [],
        categoryIds: (catsRes.data || []).map((r) => r.category_id),
      },
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function fetchCategoriesList() {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, label")
      .order("label");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   MUTATIONS
   ============================================================ */

export async function createAttribute(payload) {
  const clean = sanitizeAttributePayload(payload);
  if (clean.error) return { ok: false, error: clean.error };

  try {
    const { data, error } = await supabase
      .from("attributes")
      .insert(clean.payload)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "An attribute with that slug already exists." };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function updateAttribute(id, patch) {
  if (!id) return { ok: false, error: "Attribute id is required." };
  const clean = sanitizeAttributePayload(patch, { allowPartial: true });
  if (clean.error) return { ok: false, error: clean.error };

  try {
    const { data, error } = await supabase
      .from("attributes")
      .update(clean.payload)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "An attribute with that slug already exists." };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function deleteAttribute(id) {
  if (!id) return { ok: false, error: "Attribute id is required." };
  try {
    const { error } = await supabase.from("attributes").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Replace the full set of allowed values for a select-type
 * attribute. Sequence:
 *   1. Delete all existing rows for this attribute
 *   2. Insert new rows with positions matching input order
 *
 * Not atomic (two Supabase calls). On failure of step 2, step 1
 * has already committed. Acceptable at MVP for admin operations.
 *
 * Input shape:
 *   [{ value: "silver", label: "Silver", hex_color: "#C0C0C0" }, ...]
 */
export async function setAttributeValues(attributeId, values) {
  if (!attributeId) return { ok: false, error: "Attribute id is required." };
  if (!Array.isArray(values)) return { ok: false, error: "Values must be an array." };

  /* Validate rows up-front so we don't leave the table in a
     half-deleted state on obvious errors. */
  for (const [i, v] of values.entries()) {
    if (!v || typeof v !== "object") {
      return { ok: false, error: `Row ${i + 1}: invalid value shape.` };
    }
    if (!String(v.value || "").trim()) {
      return { ok: false, error: `Row ${i + 1}: value is required.` };
    }
    if (!String(v.label || "").trim()) {
      return { ok: false, error: `Row ${i + 1}: label is required.` };
    }
    if (v.hex_color && !/^#[0-9A-Fa-f]{6}$/.test(v.hex_color)) {
      return { ok: false, error: `Row ${i + 1}: hex color must be #RRGGBB.` };
    }
  }

  try {
    const { error: delErr } = await supabase
      .from("attribute_values")
      .delete()
      .eq("attribute_id", attributeId);
    if (delErr) return { ok: false, error: delErr.message };

    if (values.length === 0) return { ok: true };

    const rows = values.map((v, idx) => ({
      attribute_id: attributeId,
      value:        String(v.value).trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
      label:        String(v.label).trim(),
      position:     idx,
      hex_color:    v.hex_color || null,
    }));

    const { error: insErr } = await supabase.from("attribute_values").insert(rows);
    if (insErr) {
      if (insErr.code === "23505") {
        return { ok: false, error: "Duplicate value — each value must be unique within this attribute." };
      }
      return { ok: false, error: insErr.message };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Replace the set of categories this attribute applies to.
 * Same delete-then-insert pattern as setAttributeValues.
 */
export async function setAttributeCategories(attributeId, categoryIds) {
  if (!attributeId) return { ok: false, error: "Attribute id is required." };
  if (!Array.isArray(categoryIds)) return { ok: false, error: "Category ids must be an array." };

  try {
    const { error: delErr } = await supabase
      .from("category_attributes")
      .delete()
      .eq("attribute_id", attributeId);
    if (delErr) return { ok: false, error: delErr.message };

    if (categoryIds.length === 0) return { ok: true };

    const rows = categoryIds.map((cid, idx) => ({
      category_id:  cid,
      attribute_id: attributeId,
      position:     idx,
    }));

    const { error: insErr } = await supabase.from("category_attributes").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   HELPERS
   ============================================================ */

export const ATTRIBUTE_TYPES = [
  { value: "text",         label: "Text",         hint: "Free-form text. e.g. \"Made in Nigeria\"" },
  { value: "number",       label: "Number",       hint: "Numeric with optional unit. e.g. \"350\" with unit \"L\"" },
  { value: "boolean",      label: "Yes / No",     hint: "Boolean flag. e.g. \"Inverter: Yes\"" },
  { value: "select",       label: "Single Select",hint: "Pick one from allowed values. e.g. Color: Silver" },
  { value: "multi_select", label: "Multi Select", hint: "Pick many from allowed values. e.g. Features: Bluetooth + Wi-Fi" },
  { value: "color",        label: "Color",        hint: "Like Single Select but each value has a hex color for swatches" },
];

/** Attribute types that use the attribute_values table */
export function typeHasValues(type) {
  return type === "select" || type === "multi_select" || type === "color";
}

/** Attribute types that support a unit label (e.g. L, kg, HP) */
export function typeHasUnit(type) {
  return type === "number";
}

export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/* ============================================================
   INTERNAL
   ============================================================ */

function sanitizeAttributePayload(payload, { allowPartial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid payload." };
  }

  const out = {};

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) return { error: "Name is required." };
    if (name.length > 80) return { error: "Name is too long." };
    out.name = name;
  } else if (!allowPartial) {
    return { error: "Name is required." };
  }

  if (payload.slug !== undefined) {
    const slug = String(payload.slug).trim().toLowerCase();
    if (!slug) return { error: "Slug is required." };
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return { error: "Slug can only contain lowercase letters, numbers, and hyphens." };
    }
    out.slug = slug;
  } else if (!allowPartial) {
    return { error: "Slug is required." };
  }

  if (payload.type !== undefined) {
    const allowed = ATTRIBUTE_TYPES.map((t) => t.value);
    if (!allowed.includes(payload.type)) {
      return { error: `Type must be one of: ${allowed.join(", ")}` };
    }
    out.type = payload.type;
  } else if (!allowPartial) {
    return { error: "Type is required." };
  }

  if (payload.unit !== undefined) {
    out.unit = String(payload.unit).trim() || null;
  }
  if (payload.description !== undefined) {
    out.description = String(payload.description).trim() || null;
  }
  if (payload.position !== undefined) {
    const n = Number(payload.position);
    if (!Number.isInteger(n) || n < 0) return { error: "Position must be a non-negative integer." };
    out.position = n;
  }
  if (payload.is_filterable !== undefined) {
    out.is_filterable = !!payload.is_filterable;
  }
  if (payload.is_visible !== undefined) {
    out.is_visible = !!payload.is_visible;
  }

  return { payload: out };
}