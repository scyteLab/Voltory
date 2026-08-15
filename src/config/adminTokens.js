/**
 * ============================================================
 *  ADMIN THEME TOKENS
 *  The Medium-depth theme system: brand color + accent color +
 *  font family + radius scale + density + light/dark mode.
 *
 *  Each preset resolves to CSS custom properties applied via
 *  data-* attributes on the shell root. The Settings page will
 *  read these and render UI controls automatically.
 * ============================================================
 */

/**
 * Brand colors — the primary navy family. Six presets that all
 * work as an "admin console" chrome. Each preset also declares the
 * text color that reads well on it, so we don't guess at runtime.
 */
export const BRAND_PRESETS = {
  navy:    { label: "NAVEN Navy",   hex: "#0B1F3A", deep: "#081428", soft: "#E8EEF7", line: "#C7D2E4", ink: "#FFFFFF" },
  indigo:  { label: "Indigo",         hex: "#312E81", deep: "#1E1B4B", soft: "#EEF2FF", line: "#C7D2FE", ink: "#FFFFFF" },
  emerald: { label: "Emerald",        hex: "#065F46", deep: "#064E3B", soft: "#ECFDF5", line: "#A7F3D0", ink: "#FFFFFF" },
  rose:    { label: "Rose",           hex: "#9F1239", deep: "#831843", soft: "#FFF1F2", line: "#FECDD3", ink: "#FFFFFF" },
  slate:   { label: "Graphite",       hex: "#1F2937", deep: "#111827", soft: "#F1F5F9", line: "#CBD5E1", ink: "#FFFFFF" },
  royal:   { label: "Royal Blue",     hex: "#1E40AF", deep: "#1E3A8A", soft: "#EFF6FF", line: "#BFDBFE", ink: "#FFFFFF" },
};

/**
 * Accent colors — what CTAs, active states, and highlights use.
 * The mockup uses amber; we default to it but let admins pick.
 */
export const ACCENT_PRESETS = {
  amber:   { label: "Amber",   hex: "#F59E0B", ink: "#1F2937" },
  blue:    { label: "Blue",    hex: "#2563EB", ink: "#FFFFFF" },
  emerald: { label: "Emerald", hex: "#10B981", ink: "#FFFFFF" },
  violet:  { label: "Violet",  hex: "#7C3AED", ink: "#FFFFFF" },
  pink:    { label: "Pink",    hex: "#DB2777", ink: "#FFFFFF" },
  orange:  { label: "Orange",  hex: "#EA580C", ink: "#FFFFFF" },
};

/**
 * Font families — the sans-serif used across the admin. All are
 * safe system stacks or already-loaded Google Fonts.
 */
export const FONT_PRESETS = {
  inter:  { label: "Inter",           stack: '"Inter", system-ui, -apple-system, sans-serif' },
  system: { label: "System Sans",     stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  work:   { label: "Work Sans",       stack: '"Work Sans", system-ui, sans-serif' },
  ibm:    { label: "IBM Plex Sans",   stack: '"IBM Plex Sans", system-ui, sans-serif' },
  dmSans: { label: "DM Sans",         stack: '"DM Sans", system-ui, sans-serif' },
};

/**
 * Radius scale — how rounded every corner is. Compact = sharp
 * corporate feel. Generous = friendly modern feel.
 */
export const RADIUS_PRESETS = {
  sharp:      { label: "Sharp",       sm: "4px",  md: "6px",  lg: "8px" },
  balanced:   { label: "Balanced",    sm: "6px",  md: "10px", lg: "14px" }, // default
  generous:   { label: "Generous",    sm: "8px",  md: "14px", lg: "20px" },
};

/**
 * Density — how much air the layout breathes. Compact suits data-
 * heavy views; Spacious suits fewer-items-per-page workflows.
 */
export const DENSITY_PRESETS = {
  compact:    { label: "Compact",     rowH: "36px", padY: "8px",  padX: "12px", fontBase: "13px" },
  comfortable:{ label: "Comfortable", rowH: "44px", padY: "12px", padX: "16px", fontBase: "14px" }, // default
  spacious:   { label: "Spacious",    rowH: "52px", padY: "16px", padX: "20px", fontBase: "15px" },
};

/**
 * Mode — light vs dark. Only the content area recolors; the sidebar
 * uses the brand color regardless (matches Zoho/Notion behavior).
 */
export const MODES = {
  light: { label: "Light" },
  dark:  { label: "Dark" },
};

/**
 * The full default theme. Anything the user hasn't customised
 * falls back to these values.
 */
export const DEFAULT_THEME = {
  brand:   "navy",
  accent:  "amber",
  font:    "inter",
  radius:  "balanced",
  density: "comfortable",
  mode:    "light",
};

/**
 * Resolve a theme object into the CSS custom-property map that
 * gets set on the shell root. Called once per render of AdminShell.
 */
export function resolveThemeVars(theme) {
  const brand   = BRAND_PRESETS[theme.brand]     || BRAND_PRESETS[DEFAULT_THEME.brand];
  const accent  = ACCENT_PRESETS[theme.accent]   || ACCENT_PRESETS[DEFAULT_THEME.accent];
  const font    = FONT_PRESETS[theme.font]       || FONT_PRESETS[DEFAULT_THEME.font];
  const radius  = RADIUS_PRESETS[theme.radius]   || RADIUS_PRESETS[DEFAULT_THEME.radius];
  const density = DENSITY_PRESETS[theme.density] || DENSITY_PRESETS[DEFAULT_THEME.density];

  return {
    "--adm-brand":       brand.hex,
    "--adm-brand-deep":  brand.deep,
    "--adm-brand-soft":  brand.soft,
    "--adm-brand-line":  brand.line,
    "--adm-brand-ink":   brand.ink,

    "--adm-accent":      accent.hex,
    "--adm-accent-ink":  accent.ink,

    "--adm-font":        font.stack,

    "--adm-r-sm":        radius.sm,
    "--adm-r-md":        radius.md,
    "--adm-r-lg":        radius.lg,

    "--adm-row-h":       density.rowH,
    "--adm-pad-y":       density.padY,
    "--adm-pad-x":       density.padX,
    "--adm-font-base":   density.fontBase,
  };
}