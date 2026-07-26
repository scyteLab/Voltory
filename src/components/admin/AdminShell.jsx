import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ChevronRight, Home as HomeIcon } from "lucide-react";
import { AdminThemeProvider, useAdminTheme } from "../../context/AdminThemeContext.jsx";
import AdminSidebar from "./AdminSidebar.jsx";
import AdminTopbar from "./AdminTopbar.jsx";
import CommandPalette from "./CommandPalette.jsx";

/**
 * The primary admin layout. Replaces the older AdminLayout.jsx
 * (which we keep around unused for now \u2014 nothing imports it after
 * App.jsx is updated).
 *
 * Structure:
 *   <AdminThemeProvider>
 *     <div .adm-shell data-mode="light|dark" style={themeVars}>
 *       <AdminSidebar />
 *       <div .adm-main>
 *         <AdminTopbar />
 *         <Breadcrumbs />
 *         <main .adm-content><Outlet /></main>
 *       </div>
 *     </div>
 *   </AdminThemeProvider>
 */

/**
 * Route-aware breadcrumbs. Reads location.pathname and maps each
 * segment to a friendly label. Add new mappings here as new pages
 * ship. Anything unmapped falls back to a title-cased segment.
 */
const CRUMB_LABELS = {
  admin:     "Dashboard",
  products:  "Catalog Management",
  categories:"Categories",
  brands:    "Brands",
  orders:    "Orders",
  customers: "Customers",
  settings:  "Settings",
  login:     "Sign In",
};

function toLabel(seg) {
  if (CRUMB_LABELS[seg]) return CRUMB_LABELS[seg];
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);

  // No crumbs on the bare dashboard \u2014 the H1 is enough.
  if (segments.length <= 1) return null;

  const parts = segments.map((seg, i) => {
    const to = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;
    return { seg, to, label: toLabel(seg), isLast };
  });

  return (
    <nav className="adm-crumbs" aria-label="Breadcrumb">
      <Link to="/admin"><HomeIcon size={12} /> Dashboard</Link>
      {parts.slice(1).map((p) => (
        <span key={p.to} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <ChevronRight size={12} className="adm-crumbs__sep" />
          {p.isLast
            ? <span className="adm-crumbs__current">{p.label}</span>
            : <Link to={p.to}>{p.label}</Link>}
        </span>
      ))}
    </nav>
  );
}

function ShellInner() {
  const { theme, themeVars } = useAdminTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const closeDrawer = () => setDrawerOpen(false);

  const style = useMemo(() => themeVars, [themeVars]);

  // Global \u2318K / Ctrl-K to open the palette
  useEffect(() => {
    function onKey(e) {
      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isCmdK) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="adm-shell" data-mode={theme.mode} style={style}>
      <AdminSidebar open={drawerOpen} onNavigate={closeDrawer} />

      {drawerOpen && (
        <div
          className="adm-sidebar__backdrop"
          onClick={closeDrawer}
          role="button"
          aria-label="Close menu"
          tabIndex={-1}
        />
      )}

      <div className="adm-main">
        <AdminTopbar
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <Breadcrumbs />
        <main className="adm-content">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}

export default function AdminShell() {
  return (
    <AdminThemeProvider>
      <ShellInner />
    </AdminThemeProvider>
  );
}