import { supabase } from "./supabaseClient.js";

/**
 * collectionsClient  —  collections data access
 *
 * Public API (storefront):
 *   fetchActiveCollections()              — for admin/marketing lists
 *   fetchCollectionBySlug(slug)           — for /collection/:slug pages
 *
 * Admin API:
 *   fetchAllCollections()                 — includes inactive
 *   createCollection(payload)
 *   updateCollection(id, patch)
 *   deleteCollection(id)
 *   setCollectionProducts(id, skus[])     — replaces the full set
 *   fetchCollectionProducts(id)           — for the picker
 *
 * All functions return { ok, data?, error? } shape to match
 * the rest of the codebase's conventions.
 */

/* ============================================================
   STOREFRONT
   ============================================================ */

export async function fetchActiveCollections() {
  try {
    const { data, error } = await supabase
      .from("collections")
      .select("id, slug, name, description, banner_image")
      .eq("is_active", true)
      .order("name");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Fetch a single collection by slug, with its products in
 * position order. Only returns active collections (RLS enforces
 * this too, but explicit is safer).
 */
export async function fetchCollectionBySlug(slug) {
  if (!slug) return { ok: false, error: "Slug is required." };

  try {
    /* Fetch the collection */
    const { data: collection, error: cErr } = await supabase
      .from("collections")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (cErr) return { ok: false, error: cErr.message };
    if (!collection) return { ok: false, error: "Collection not found." };

    /* Fetch the products in this collection, joined to product data */
    const { data: rows, error: pErr } = await supabase
      .from("collection_products")
      .select("position, product_sku, products!inner (sku, slug, name, brand, category, price, image, status)")
      .eq("collection_id", collection.id)
      .order("position");

    if (pErr) return { ok: false, error: pErr.message };

    /* Flatten to product rows, filter out inactive products */
    const products = (rows || [])
      .map((r) => r.products)
      .filter((p) => p && p.status !== "inactive");

    return { ok: true, data: { collection, products } };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   ADMIN
   ============================================================ */

export async function fetchAllCollections() {
  try {
    /* Product-count subquery via a left-join and count via
       collection_products. We fetch the join count client-side
       to keep the query simple. */
    const { data: collections, error } = await supabase
      .from("collections")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return { ok: false, error: error.message };

    /* Fetch counts per collection in one query */
    const { data: counts, error: cErr } = await supabase
      .from("collection_products")
      .select("collection_id");
    if (cErr) return { ok: false, error: cErr.message };

    const countMap = new Map();
    for (const row of counts || []) {
      countMap.set(row.collection_id, (countMap.get(row.collection_id) || 0) + 1);
    }

    const enriched = (collections || []).map((c) => ({
      ...c,
      product_count: countMap.get(c.id) || 0,
    }));

    return { ok: true, data: enriched };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function fetchCollectionById(id) {
  if (!id) return { ok: false, error: "ID is required." };
  try {
    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data)  return { ok: false, error: "Collection not found." };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function createCollection(payload) {
  const clean = sanitizeCollectionPayload(payload);
  if (clean.error) return { ok: false, error: clean.error };

  try {
    const { data, error } = await supabase
      .from("collections")
      .insert(clean.payload)
      .select()
      .single();
    if (error) {
      /* Friendlier error for slug collision */
      if (error.code === "23505") {
        return { ok: false, error: "A collection with that slug already exists." };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function updateCollection(id, patch) {
  if (!id) return { ok: false, error: "ID is required." };
  const clean = sanitizeCollectionPayload(patch, { allowPartial: true });
  if (clean.error) return { ok: false, error: clean.error };

  try {
    const { data, error } = await supabase
      .from("collections")
      .update(clean.payload)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "A collection with that slug already exists." };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function deleteCollection(id) {
  if (!id) return { ok: false, error: "ID is required." };
  try {
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Fetch just the SKUs currently in a collection (for the
 * product picker's "already selected" state).
 */
export async function fetchCollectionProductSkus(collectionId) {
  if (!collectionId) return { ok: true, data: [] };
  try {
    const { data, error } = await supabase
      .from("collection_products")
      .select("product_sku, position")
      .eq("collection_id", collectionId)
      .order("position");
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: (data || []).map((r) => r.product_sku) };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Replace the full set of products in a collection.
 *   1. Delete all existing rows for this collection
 *   2. Insert new rows with sequential positions
 * Wrapped in a "best effort transaction" — two Supabase calls,
 * not atomic. On failure of step 2, step 1 already committed.
 * Acceptable for admin-side operations at MVP.
 */
export async function setCollectionProducts(collectionId, skus) {
  if (!collectionId) return { ok: false, error: "Collection ID is required." };
  if (!Array.isArray(skus)) return { ok: false, error: "Products must be an array." };

  try {
    /* Wipe existing */
    const { error: delErr } = await supabase
      .from("collection_products")
      .delete()
      .eq("collection_id", collectionId);
    if (delErr) return { ok: false, error: delErr.message };

    if (skus.length === 0) return { ok: true };

    /* Insert with positions */
    const rows = skus.map((sku, idx) => ({
      collection_id: collectionId,
      product_sku:   sku,
      position:      idx,
    }));

    const { error: insErr } = await supabase
      .from("collection_products")
      .insert(rows);
    if (insErr) return { ok: false, error: insErr.message };

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   Product picker helpers
   ============================================================ */

/**
 * Paginated product search for the collection picker.
 * Returns products matching a query string, narrowed further by
 * category and/or brand when provided.
 */
export async function searchProductsForPicker({ q = "", category = "", brand = "", limit = 30, offset = 0 }) {
  try {
    let query = supabase
      .from("products")
      .select("sku, name, brand, category, price, image", { count: "exact" })
      .eq("status", "active")
      .order("name")
      .range(offset, offset + limit - 1);

    if (q.trim()) {
      /* Simple ilike search on name + sku. Not full-text but
         plenty for MVP with hundreds of products. */
      const term = `%${q.trim()}%`;
      query = query.or(`name.ilike.${term},sku.ilike.${term}`);
    }
    if (category) {
      query = query.eq("category", category);
    }
    if (brand) {
      query = query.eq("brand", brand);
    }

    const { data, error, count } = await query;
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [], total: count || 0 };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   Internal
   ============================================================ */

function sanitizeCollectionPayload(payload, { allowPartial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    return { error: "Invalid payload." };
  }

  const out = {};

  if (payload.name !== undefined) {
    const name = String(payload.name).trim();
    if (!name) return { error: "Name is required." };
    if (name.length > 120) return { error: "Name is too long." };
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

  if (payload.description !== undefined) {
    out.description = String(payload.description).trim() || null;
  }
  if (payload.banner_image !== undefined) {
    const url = String(payload.banner_image).trim();
    out.banner_image = url || null;
  }
  if (payload.is_active !== undefined) {
    out.is_active = !!payload.is_active;
  }

  return { payload: out };
}

/**
 * Slugify a name into a URL-safe slug.
 * Used by the admin form for the "auto-generate slug" button.
 */
export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}