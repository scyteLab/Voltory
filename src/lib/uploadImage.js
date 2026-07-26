import { supabase } from "./supabaseClient.js";

/**
 * Thin wrapper around Supabase Storage for the product-images bucket.
 * Handles: file validation, unique naming, upload, deletion, public URL.
 *
 * File paths inside the bucket look like:
 *   {sku}/{timestamp}-{random}.{ext}
 *
 * This lets us group images by SKU for easy cleanup, while avoiding
 * name collisions when the same file is uploaded twice.
 */
const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/avif",
]);

/**
 * Validate a File before uploading. Returns { ok: true } or { ok: false, reason }.
 */
export function validateImageFile(file) {
  if (!file) return { ok: false, reason: "No file provided." };
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, reason: `Unsupported file type (${file.type || "unknown"}). Use JPEG, PNG, WebP, or AVIF.` };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: `Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 5 MB.` };
  }
  return { ok: true };
}

/**
 * Derive a filesystem-safe file extension from a File.
 */
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
 * Upload one File to the product-images bucket. Returns the
 * public URL (safe to persist in products.image or highlights).
 *
 * skuHint groups uploads by product. Use "unassigned" if the
 * product doesn't have a SKU yet.
 */
export async function uploadProductImage(file, { skuHint = "unassigned" } = {}) {
  const check = validateImageFile(file);
  if (!check.ok) throw new Error(check.reason);

  const ext = extForFile(file);
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const safeSku = String(skuHint).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "unassigned";
  const path = `${safeSku}/${ts}-${rand}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/**
 * Given a full public URL previously written by uploadProductImage,
 * extract the object path so we can delete it.
 * Returns null if the URL isn't in our bucket.
 */
export function pathFromPublicUrl(url) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

/**
 * Delete one image by its public URL. Silently ignores URLs that
 * aren't in our bucket (e.g. hard-coded /products/foo.png assets).
 */
export async function deleteProductImage(url) {
  const path = pathFromPublicUrl(url);
  if (!path) return { deleted: false, reason: "not-in-bucket" };
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
  return { deleted: true };
}