import { supabase } from "./supabaseClient.js";

/**
 * productAttributesClient
 *
 * Per-product attribute operations, kept separate from the
 * catalog bulk-load path so the storefront's initial payload
 * stays lean. Each customer product page fetches its own
 * attribute values on mount.
 *
 * Session 3 additions:
 *   · fetchProductAttributesForCategory  — bulk-load ALL
 *     product attribute assignments for every product in a
 *     category in a single query. Used by the Category page
 *     to enable in-memory attribute filtering.
 *   · fetchFilterableAttributesForCategory — like
 *     fetchAttributesForCategory but restricted to
 *     is_filterable=true attributes. Used by FilterSidebar
 *     to render only filter-enabled attributes.
 *
 * Public API:
 *   fetchAttributesForCategory(categoryId)
 *       — all attributes applying to a category (with values)
 *   fetchFilterableAttributesForCategory(categoryId)         [NEW S3]
 *       — same, but only is_filterable=true
 *   fetchProductAttributes(productSku)
 *       — assigned values for one product (used by SpecsTabs)
 *   fetchProductAttributesForCategory(categoryId)             [NEW S3]
 *       — assigned values for EVERY product in a category
 *   saveProductAttributes(productSku, assignments[])
 *
 * Helpers:
 *   attributesToSpecRows(pavRows)
 *   buildProductAttributeMap(pavRows)                          [NEW S3]
 */

/* ============================================================
   FETCH
   ============================================================ */

export async function fetchAttributesForCategory(categoryId) {
  if (!categoryId) return { ok: true, data: [] };

  try {
    const { data: mapRows, error: mapErr } = await supabase
      .from("category_attributes")
      .select("attribute_id, position")
      .eq("category_id", categoryId);
    if (mapErr) return { ok: false, error: mapErr.message };

    const mappedIds = new Set((mapRows || []).map((r) => r.attribute_id));

    const [attrsRes, allMappingsRes] = await Promise.all([
      supabase.from("attributes").select("*").order("position").order("name"),
      supabase.from("category_attributes").select("attribute_id"),
    ]);
    if (attrsRes.error)       return { ok: false, error: attrsRes.error.message };
    if (allMappingsRes.error) return { ok: false, error: allMappingsRes.error.message };

    const mappedAnywhere = new Set((allMappingsRes.data || []).map((r) => r.attribute_id));

    const relevantAttrs = (attrsRes.data || []).filter((a) => (
      mappedIds.has(a.id) || !mappedAnywhere.has(a.id)
    ));

    if (relevantAttrs.length === 0) {
      return { ok: true, data: [] };
    }

    const attrIds = relevantAttrs.map((a) => a.id);
    const { data: values, error: valErr } = await supabase
      .from("attribute_values")
      .select("*")
      .in("attribute_id", attrIds)
      .order("position");
    if (valErr) return { ok: false, error: valErr.message };

    const valuesByAttr = new Map();
    for (const v of values || []) {
      if (!valuesByAttr.has(v.attribute_id)) valuesByAttr.set(v.attribute_id, []);
      valuesByAttr.get(v.attribute_id).push(v);
    }

    const enriched = relevantAttrs.map((a) => ({
      ...a,
      allowed_values: valuesByAttr.get(a.id) || [],
    }));

    return { ok: true, data: enriched };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Session 3: fetch attributes for a category, filtered to only
 * those with is_filterable=true. Used by FilterSidebar so the
 * "Show as filter" toggle in admin actually controls filter UI.
 */
export async function fetchFilterableAttributesForCategory(categoryId) {
  const res = await fetchAttributesForCategory(categoryId);
  if (!res.ok) return res;
  return { ok: true, data: res.data.filter((a) => a.is_filterable !== false) };
}

/**
 * Fetch assigned attribute values for a single product.
 */
export async function fetchProductAttributes(productSku) {
  if (!productSku) return { ok: false, error: "Product SKU is required." };

  try {
    const { data, error } = await supabase
      .from("product_attribute_values")
      .select(`
        id,
        attribute_id,
        attribute_value_id,
        value_text,
        value_number,
        value_boolean,
        attribute:attributes!inner (id, slug, name, type, unit, is_visible, position),
        attribute_value:attribute_values (id, value, label, hex_color)
      `)
      .eq("product_sku", productSku);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Session 3: bulk-fetch ALL product attribute assignments for
 * every product in a given category. Single query, joined to
 * attributes and attribute_values.
 *
 * Returns raw pav rows — caller (Category page) groups them
 * by product_sku for filter matching.
 *
 * Efficient at NAVEN's scale (tens of products per category
 * → tens to hundreds of rows total). Not intended for catalogs
 * with tens of thousands of assignments — that would want
 * server-side filtering (Session 3 alt path, deliberately
 * rejected during scope discussion given actual catalog size).
 */
export async function fetchProductAttributesForCategory(categoryId) {
  if (!categoryId) return { ok: true, data: [] };

  try {
    /* Step 1: find product SKUs in this category. We fetch just
       the SKU column to keep the payload minimal. */
    const { data: prods, error: pErr } = await supabase
      .from("products")
      .select("sku")
      .eq("category", categoryId);
    if (pErr) return { ok: false, error: pErr.message };

    const skus = (prods || []).map((p) => p.sku);
    if (skus.length === 0) return { ok: true, data: [] };

    /* Step 2: fetch all attribute assignments for those SKUs,
       joined with attribute and attribute_value metadata. */
    const { data, error } = await supabase
      .from("product_attribute_values")
      .select(`
        product_sku,
        attribute_id,
        attribute_value_id,
        value_text,
        value_number,
        value_boolean,
        attribute:attributes!inner (id, slug, name, type, unit, is_filterable, is_visible, position),
        attribute_value:attribute_values (id, value, label, hex_color)
      `)
      .in("product_sku", skus);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   SAVE
   ============================================================ */

export async function saveProductAttributes(productSku, assignments) {
  if (!productSku) return { ok: false, error: "Product SKU is required." };
  if (!Array.isArray(assignments)) return { ok: false, error: "Assignments must be an array." };

  try {
    const { error: delErr } = await supabase
      .from("product_attribute_values")
      .delete()
      .eq("product_sku", productSku);
    if (delErr) return { ok: false, error: delErr.message };

    const rows = [];
    for (const a of assignments) {
      if (!a || !a.attribute_id || !a.type) continue;

      switch (a.type) {
        case "text": {
          const v = String(a.value_text || "").trim();
          if (!v) continue;
          rows.push({
            product_sku:  productSku,
            attribute_id: a.attribute_id,
            value_text:   v,
          });
          break;
        }
        case "number": {
          if (a.value_number === "" || a.value_number == null) continue;
          const n = Number(a.value_number);
          if (!Number.isFinite(n)) continue;
          rows.push({
            product_sku:  productSku,
            attribute_id: a.attribute_id,
            value_number: n,
          });
          break;
        }
        case "boolean": {
          if (a.value_boolean == null) continue;
          rows.push({
            product_sku:  productSku,
            attribute_id: a.attribute_id,
            value_boolean: !!a.value_boolean,
          });
          break;
        }
        case "select":
        case "color": {
          if (!a.attribute_value_id) continue;
          rows.push({
            product_sku:        productSku,
            attribute_id:       a.attribute_id,
            attribute_value_id: a.attribute_value_id,
          });
          break;
        }
        case "multi_select": {
          const ids = Array.isArray(a.attribute_value_ids) ? a.attribute_value_ids : [];
          for (const vid of ids) {
            if (!vid) continue;
            rows.push({
              product_sku:        productSku,
              attribute_id:       a.attribute_id,
              attribute_value_id: vid,
            });
          }
          break;
        }
        default:
          continue;
      }
    }

    if (rows.length === 0) return { ok: true, data: { inserted: 0 } };

    const { error: insErr } = await supabase
      .from("product_attribute_values")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };

    return { ok: true, data: { inserted: rows.length } };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   HELPERS
   ============================================================ */

function formatValue(row, type, unit) {
  switch (type) {
    case "text":         return row.value_text || "";
    case "number": {
      if (row.value_number == null) return "";
      const num = Number(row.value_number);
      return unit ? `${num} ${unit}` : String(num);
    }
    case "boolean":      return row.value_boolean ? "Yes" : "No";
    case "select":
    case "color":        return row.attribute_value?.label || row.attribute_value?.value || "";
    default:             return "";
  }
}

export function attributesToSpecRows(pavRows) {
  if (!Array.isArray(pavRows) || pavRows.length === 0) return [];

  const byAttr = new Map();
  for (const row of pavRows) {
    const attr = row.attribute;
    if (!attr) continue;
    if (attr.is_visible === false) continue;

    const key = attr.id;
    if (!byAttr.has(key)) {
      byAttr.set(key, { attribute: attr, rows: [] });
    }
    byAttr.get(key).rows.push(row);
  }

  const out = [];
  for (const { attribute, rows } of byAttr.values()) {
    let value = "";

    if (attribute.type === "multi_select") {
      value = rows
        .map((r) => r.attribute_value?.label || r.attribute_value?.value || "")
        .filter(Boolean)
        .join(", ");
    } else {
      value = formatValue(rows[0], attribute.type, attribute.unit);
    }

    if (!value) continue;

    out.push({
      label:    attribute.name,
      value,
      _position: attribute.position || 0,
      _fromAttribute: true,
    });
  }

  out.sort((a, b) => a._position - b._position);
  return out;
}

/**
 * Session 3: turn raw pav rows (bulk-fetched for a category)
 * into a Map<product_sku, Map<attribute_slug, value(s)>>.
 *
 * Value shape depends on attribute type:
 *   text          → string
 *   number        → number
 *   boolean       → boolean
 *   select        → string (the value_value, not label)
 *   color         → string (the value_value)
 *   multi_select  → array of strings
 *
 * Used by Category page filter application: a product matches
 * a filter if productAttrMap.get(sku)?.get(slug) contains/equals
 * the filter value.
 */
export function buildProductAttributeMap(pavRows) {
  const map = new Map();

  for (const row of pavRows || []) {
    const sku = row.product_sku;
    const attr = row.attribute;
    if (!sku || !attr) continue;

    if (!map.has(sku)) map.set(sku, new Map());
    const productMap = map.get(sku);

    const slug = attr.slug;

    switch (attr.type) {
      case "text":
        productMap.set(slug, row.value_text || "");
        break;
      case "number":
        productMap.set(slug, row.value_number == null ? null : Number(row.value_number));
        break;
      case "boolean":
        productMap.set(slug, !!row.value_boolean);
        break;
      case "select":
      case "color": {
        const v = row.attribute_value?.value;
        if (v) productMap.set(slug, v);
        break;
      }
      case "multi_select": {
        const v = row.attribute_value?.value;
        if (!v) break;
        const existing = productMap.get(slug);
        if (Array.isArray(existing)) existing.push(v);
        else productMap.set(slug, [v]);
        break;
      }
      default:
        break;
    }
  }

  return map;
}