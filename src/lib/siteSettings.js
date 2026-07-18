import { supabase } from "./supabaseClient.js";
import { SITE } from "../config/site.js";

/** Fallback used whenever Supabase is unreachable/unconfigured — the
 * storefront must never hang or break just because appearance settings
 * couldn't be fetched. */
export const DEFAULT_SITE_SETTINGS = { theme: SITE.defaultTheme, font_pair: "default" };

export async function fetchSiteSettings() {
  const { data, error } = await supabase.from("site_settings").select("theme, font_pair").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateSiteSettings({ theme, font_pair }) {
  const { data, error } = await supabase
    .from("site_settings")
    .update({ theme, font_pair })
    .eq("id", 1)
    .select("theme, font_pair")
    .single();
  if (error) throw error;
  return data;
}
