import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  // Loud in dev, not a thrown error — createClient() requires a
  // well-formed URL even when unused, and AdminProvider wraps the
  // entire app (not just /admin), so throwing here would take down
  // the whole storefront whenever .env isn't set up yet.
  console.warn(
    "Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). " +
    "Admin routes will not work until .env is set up — see supabase/schema.sql."
  );
}

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-anon-key"
);
