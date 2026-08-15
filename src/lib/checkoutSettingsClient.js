import { supabase } from "./supabaseClient.js";

/**
 * checkoutSettingsClient  —  DB-backed checkout math settings
 *
 * The DB is authoritative when reachable. But we never want a
 * broken Supabase connection to break checkout, so every setting
 * has a hardcoded fallback constant. If the fetch fails or the
 * key is missing, we quietly use the fallback — checkout still
 * works, admin just can't override the value in that moment.
 *
 * Named checkoutSettings* (not siteSettings*) because the
 * project already has a `site_settings` table for theme choices.
 *
 * Public API:
 *   fetchCheckoutSettings()      → { ok, settings: { key: parsedValue } }
 *   getSetting(map, key)         → parsed value or fallback
 *   updateCheckoutSetting(k, v)  → { ok, error? }
 *   FALLBACKS                    — source-of-truth fallback constants
 */

/**
 * Hardcoded fallback values. MUST match the seed values in
 * supabase/checkout_settings_seed.sql. If you change one here,
 * change the seed too.
 */
export const FALLBACKS = Object.freeze({
  free_delivery_threshold_ngn:   150000,
  default_checkout_discount_pct: 0,
});

/**
 * Parse a raw DB string against its expected type. Returns the
 * parsed value or the fallback if parsing fails.
 */
function parse(key, raw) {
  if (raw == null || raw === "") return FALLBACKS[key];
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.warn(`[checkout-settings] '${key}' has non-numeric value '${raw}', using fallback`);
    return FALLBACKS[key];
  }
  return n;
}

/**
 * Fetch all checkout settings. Returns a map keyed by setting
 * name with parsed values. On error, returns an empty map —
 * getSetting() falls back to hardcoded constants transparently.
 */
export async function fetchCheckoutSettings() {
  try {
    const { data, error } = await supabase
      .from("checkout_settings")
      .select("key, value");

    if (error) {
      console.warn("[checkout-settings] fetch failed, using fallbacks:", error.message);
      return { ok: false, settings: {} };
    }

    const settings = {};
    for (const row of data || []) {
      settings[row.key] = parse(row.key, row.value);
    }
    return { ok: true, settings };
  } catch (err) {
    console.warn("[checkout-settings] fetch threw, using fallbacks:", err);
    return { ok: false, settings: {} };
  }
}

/**
 * Type-safe accessor. Never throws, never returns undefined.
 */
export function getSetting(settingsMap, key) {
  if (settingsMap && Object.prototype.hasOwnProperty.call(settingsMap, key)) {
    return settingsMap[key];
  }
  return FALLBACKS[key];
}

/**
 * Update a single setting. Stores as text; parsing happens on
 * next read.
 */
export async function updateCheckoutSetting(key, value) {
  try {
    const { error } = await supabase
      .from("checkout_settings")
      .upsert(
        { key, value: String(value) },
        { onConflict: "key" }
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}