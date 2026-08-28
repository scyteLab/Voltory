import { supabase } from "./supabaseClient.js";

/**
 * adminOffersClient
 *
 * CRUD operations for the product_offers table. Used by the
 * OffersAdmin state slice inside CatalogContext.
 *
 * All functions return { ok, data?, error? } for consistent
 * handling in the UI.
 *
 * Public API:
 *   fetchAllOffers()                 → all offers with product join
 *   fetchOfferById(id)               → single offer with product join
 *   fetchOfferBySku(sku)             → offer attached to a specific product
 *   createOffer(payload)             → insert new offer
 *   updateOffer(id, payload)         → update existing offer
 *   deleteOffer(id)                  → remove offer
 *   toggleOfferActive(id, isActive)  → pause/resume without deleting
 *   uploadGiftImage(file, offerId)   → upload gift image, return public URL
 *   deleteGiftImage(imageUrl)        → remove gift image from storage
 *
 * Uses the existing product-images bucket with an 'offers/'
 * subfolder to keep gift images grouped separately from
 * product photos.
 */

const BUCKET = "product-images";
const OFFERS_FOLDER = "offers";

/* ============================================================
   FETCH
   ============================================================ */

export async function fetchAllOffers() {
  try {
    const { data, error } = await supabase
      .from("product_offers")
      .select(`
        id,
        product_sku,
        title,
        gift_description,
        gift_image,
        multiply_by_qty,
        ends_at,
        is_active,
        created_at,
        updated_at,
        product:products (sku, name, brand, category, image, price)
      `)
      .order("created_at", { ascending: false });

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || [] };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function fetchOfferById(id) {
  if (!id) return { ok: false, error: "Offer ID is required." };

  try {
    const { data, error } = await supabase
      .from("product_offers")
      .select(`
        id,
        product_sku,
        title,
        gift_description,
        gift_image,
        multiply_by_qty,
        ends_at,
        is_active,
        created_at,
        updated_at,
        product:products (sku, name, brand, category, image, price)
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    if (!data)  return { ok: false, error: "Offer not found." };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Look up an offer attached to a specific product SKU.
 * Storefront uses this to check if a product has an active offer.
 * Returns { ok: true, data: null } if no offer exists (not an error).
 */
export async function fetchOfferBySku(sku) {
  if (!sku) return { ok: false, error: "SKU is required." };

  try {
    const { data, error } = await supabase
      .from("product_offers")
      .select(`
        id,
        product_sku,
        title,
        gift_description,
        gift_image,
        multiply_by_qty,
        ends_at,
        is_active
      `)
      .eq("product_sku", sku)
      .maybeSingle();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: data || null };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   CREATE / UPDATE / DELETE
   ============================================================ */

export async function createOffer(payload) {
  const validation = validateOfferPayload(payload);
  if (!validation.ok) return validation;

  try {
    const insertPayload = {
      product_sku:      payload.product_sku,
      title:            payload.title.trim(),
      gift_description: payload.gift_description.trim(),
      gift_image:       payload.gift_image || null,
      multiply_by_qty:  !!payload.multiply_by_qty,
      ends_at:          payload.ends_at,
      is_active:        payload.is_active !== false, // default true
    };

    const { data, error } = await supabase
      .from("product_offers")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      /* Real friendly message for the UNIQUE constraint violation */
      if (error.code === "23505") {
        return {
          ok: false,
          error: `This product already has an offer. Delete or edit the existing offer first.`,
        };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function updateOffer(id, payload) {
  if (!id) return { ok: false, error: "Offer ID is required." };

  const validation = validateOfferPayload(payload, { partial: true });
  if (!validation.ok) return validation;

  try {
    const updatePayload = {};
    if (payload.title !== undefined)            updatePayload.title = payload.title.trim();
    if (payload.gift_description !== undefined) updatePayload.gift_description = payload.gift_description.trim();
    if (payload.gift_image !== undefined)       updatePayload.gift_image = payload.gift_image || null;
    if (payload.multiply_by_qty !== undefined)  updatePayload.multiply_by_qty = !!payload.multiply_by_qty;
    if (payload.ends_at !== undefined)          updatePayload.ends_at = payload.ends_at;
    if (payload.is_active !== undefined)        updatePayload.is_active = !!payload.is_active;

    /* Note: we don't allow changing product_sku on update. To move
       an offer to a different product, delete and recreate. This
       prevents accidentally breaking cart integration later. */

    const { data, error } = await supabase
      .from("product_offers")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function deleteOffer(id) {
  if (!id) return { ok: false, error: "Offer ID is required." };

  try {
    /* First fetch the offer to get its gift_image URL for cleanup */
    const { data: offer } = await supabase
      .from("product_offers")
      .select("gift_image")
      .eq("id", id)
      .maybeSingle();

    /* Delete the DB row */
    const { error } = await supabase
      .from("product_offers")
      .delete()
      .eq("id", id);

    if (error) return { ok: false, error: error.message };

    /* Best-effort: delete the gift image from storage.
       Silently ignore failure — orphaned images are cleaner
       than leaving DB row references pointing to deleted files. */
    if (offer?.gift_image) {
      try {
        await deleteGiftImage(offer.gift_image);
      } catch { /* ignore */ }
    }

    return { ok: true, data: { id } };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

export async function toggleOfferActive(id, isActive) {
  if (!id) return { ok: false, error: "Offer ID is required." };

  try {
    const { data, error } = await supabase
      .from("product_offers")
      .update({ is_active: !!isActive })
      .eq("id", id)
      .select()
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   IMAGE UPLOAD
   ============================================================
   Reuses the existing product-images bucket with an 'offers/'
   subfolder. Real path pattern:
     offers/{offerIdOrSlug}/{timestamp}-{random}.{ext}
*/

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, matches uploadImage.js
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif",
]);

function extForFile(file) {
  const mimeExt = {
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/avif": "avif",
  }[file.type];
  if (mimeExt) return mimeExt;
  const named = (file.name || "").split(".").pop()?.toLowerCase();
  return named && /^[a-z0-9]{2,5}$/.test(named) ? named : "jpg";
}

/**
 * Upload a gift image to storage. Returns the public URL.
 * offerIdOrSlug groups uploads for cleanup — pass the offer's
 * ID (edit mode) or "new" (create mode).
 */
export async function uploadGiftImage(file, offerIdOrSlug = "new") {
  if (!file) return { ok: false, error: "No file provided." };

  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      ok: false,
      error: `Unsupported file type (${file.type || "unknown"}). Use JPEG, PNG, WebP, or AVIF.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 5 MB.`,
    };
  }

  try {
    const ext = extForFile(file);
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const safeId = String(offerIdOrSlug).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "new";
    const path = `${OFFERS_FOLDER}/${safeId}/${ts}-${rand}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (upErr) return { ok: false, error: upErr.message };

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { ok: true, data: { path, publicUrl: data.publicUrl } };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Extract the storage path from a public URL and delete the file.
 * Returns { ok: true, data: { deleted: true|false } }.
 */
export async function deleteGiftImage(url) {
  if (!url) return { ok: true, data: { deleted: false, reason: "no-url" } };

  try {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return { ok: true, data: { deleted: false, reason: "not-in-bucket" } };

    const path = url.slice(idx + marker.length);
    const { error } = await supabase.storage.from(BUCKET).remove([path]);

    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { deleted: true, path } };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

/* ============================================================
   VALIDATION
   ============================================================ */

function validateOfferPayload(payload, { partial = false } = {}) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Offer payload is required." };
  }

  const errors = [];

  /* Required fields on create */
  if (!partial) {
    if (!payload.product_sku)      errors.push("Product SKU is required");
    if (!payload.title?.trim())    errors.push("Offer title is required");
    if (!payload.gift_description?.trim()) errors.push("Gift description is required");
    if (!payload.ends_at)          errors.push("End date is required");
  }

  /* Validate individual fields if provided */
  if (payload.title !== undefined) {
    const title = String(payload.title).trim();
    if (title.length === 0) errors.push("Offer title cannot be empty");
    if (title.length > 200) errors.push("Offer title must be under 200 characters");
  }

  if (payload.gift_description !== undefined) {
    const gd = String(payload.gift_description).trim();
    if (gd.length === 0) errors.push("Gift description cannot be empty");
    if (gd.length > 500) errors.push("Gift description must be under 500 characters");
  }

  if (payload.ends_at !== undefined) {
    const dt = new Date(payload.ends_at);
    if (isNaN(dt.getTime())) {
      errors.push("End date is not a valid date");
    } else if (dt.getTime() < Date.now()) {
      errors.push("End date must be in the future");
    }
  }

  if (errors.length > 0) {
    return { ok: false, error: errors.join(", ") };
  }

  return { ok: true };
}