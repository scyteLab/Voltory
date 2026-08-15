import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { useAdmin } from "./AdminContext.jsx";
import { DEFAULT_THEME, resolveThemeVars } from "../config/adminTokens.js";

/**
 * Admin theme provider.
 *
 * Persistence strategy:
 *   1) When an admin is signed in, load their row from
 *      admin_preferences (Supabase). Save changes back there.
 *   2) When no admin is signed in (login page), read/write
 *      localStorage under "voltory_admin_theme_local". This lets
 *      even the login screen respect the last theme.
 *   3) On sign-out, we keep the localStorage copy — same admin
 *      returning sees the same theme.
 *
 * The provider exposes:
 *   theme       — the current theme object
 *   setTheme    — (key, value) => merges + persists + re-applies
 *   resetTheme  — back to DEFAULT_THEME
 *   themeVars   — the resolved CSS custom-property map, so any
 *                 component (AdminShell) can apply it as style={}.
 */
const Ctx = createContext(null);
const LOCAL_KEY = "voltory_admin_theme_local";

function readLocalTheme() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? { ...DEFAULT_THEME, ...JSON.parse(raw) } : { ...DEFAULT_THEME };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

function writeLocalTheme(theme) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(theme));
  } catch {
    /* noop */
  }
}

export function AdminThemeProvider({ children }) {
  const { session } = useAdmin();
  const [theme, setThemeState] = useState(() => readLocalTheme());

  // On session change: try to hydrate from Supabase. Fall through to
  // whatever's in state (the localStorage default) if the fetch fails
  // — e.g. table not yet created, offline, etc.
  useEffect(() => {
    if (!session?.user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("admin_preferences")
          .select("theme")
          .eq("user_id", session.user.id)
          .maybeSingle();
        if (cancelled) return;
        if (!error && data?.theme) {
          const merged = { ...DEFAULT_THEME, ...data.theme };
          setThemeState(merged);
          writeLocalTheme(merged);
        }
      } catch {
        /* stay on local theme */
      }
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  async function setTheme(key, value) {
    const next = { ...theme, [key]: value };
    setThemeState(next);
    writeLocalTheme(next);
    // Best-effort remote persistence — do NOT block UI on a failure.
    if (session?.user?.id) {
      try {
        await supabase
          .from("admin_preferences")
          .upsert(
            { user_id: session.user.id, theme: next, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
      } catch {
        /* offline / RLS block / etc — local copy still saved */
      }
    }
  }

  function resetTheme() {
    setThemeState({ ...DEFAULT_THEME });
    writeLocalTheme({ ...DEFAULT_THEME });
    if (session?.user?.id) {
      supabase
        .from("admin_preferences")
        .upsert(
          { user_id: session.user.id, theme: DEFAULT_THEME, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        )
        .then(() => {}, () => {});
    }
  }

  const themeVars = resolveThemeVars(theme);

  return (
    <Ctx.Provider value={{ theme, setTheme, resetTheme, themeVars }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAdminTheme = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminTheme must be used inside <AdminThemeProvider>");
  return ctx;
};