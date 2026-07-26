import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Box, LayoutDashboard, Package, Search,
  Settings as SettingsIcon, ShoppingCart, Users, X,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient.js";

/**
 * The \u2318K command palette. Opens as a centered modal. Types-to-
 * search across:
 *   \u00B7 Static navigation items (Dashboard, Products, Settings)
 *   \u00B7 Products from Supabase (name + sku match)
 *   \u00B7 Orders from Supabase (customer_name + id match)
 *
 * Keyboard:
 *   \u2318K / Ctrl-K \u2014 toggle open
 *   Esc            \u2014 close
 *   \u2191\u2193             \u2014 move highlighted item
 *   Enter          \u2014 navigate
 */

const NAV_ITEMS = [
  { id: "nav-dash",      label: "Dashboard",         to: "/admin",            icon: LayoutDashboard },
  { id: "nav-products",  label: "Catalog Products",  to: "/admin/products",   icon: Package },
  { id: "nav-orders",    label: "Orders",            to: "/admin/orders",     icon: ShoppingCart },
  { id: "nav-customers", label: "Customers",         to: "/admin/customers",  icon: Users },
  { id: "nav-settings",  label: "Settings",          to: "/admin/settings",   icon: SettingsIcon },
];

export default function CommandPalette({ open, onClose }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState({ products: [], orders: [], customers: [] });
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Reset when opening / closing
  useEffect(() => {
    if (open) {
      setQ("");
      setResults({ products: [], orders: [], customers: [] });
      setHighlight(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // Search remote data (debounced)
  useEffect(() => {
    if (!open || !q.trim()) {
      setResults({ products: [], orders: [], customers: [] });
      return;
    }
    let cancelled = false;
    setLoading(true);
    const term = q.trim();
    const t = setTimeout(async () => {
      try {
        const [p, o, c] = await Promise.all([
          supabase.from("products")
            .select("sku, name, slug, price, stock")
            .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
            .limit(4),
          supabase.from("orders")
            .select("id, customer_name, total, status, created_at")
            .or(`id.ilike.%${term}%,customer_name.ilike.%${term}%`)
            .limit(4),
          supabase.from("customers_summary")
            .select("phone, name, order_count, total_spent")
            .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
            .limit(4),
        ]);
        if (cancelled) return;
        setResults({
          products:  p.data || [],
          orders:    o.data || [],
          customers: c.data || [],
        });
      } catch { /* stay empty */ }
      finally { if (!cancelled) setLoading(false); }
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  // Flatten into a single indexed list so \u2191\u2193 highlights work
  const flat = useMemo(() => {
    const items = [];
    const term = q.trim().toLowerCase();
    const filteredNav = term
      ? NAV_ITEMS.filter((i) => i.label.toLowerCase().includes(term))
      : NAV_ITEMS;
    filteredNav.forEach((n) => items.push({ kind: "nav", ...n }));
    (results.products || []).forEach((p) =>
      items.push({ kind: "product", id: p.sku, ...p })
    );
    (results.orders || []).forEach((o) =>
      items.push({ kind: "order", ...o })
    );
    (results.customers || []).forEach((c) =>
      items.push({ kind: "customer", id: c.phone, ...c })
    );
    return items;
  }, [q, results]);

  // Keyboard within the palette
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, flat.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        activate(flat[highlight]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, highlight, onClose]);

  function activate(item) {
    if (!item) return;
    if (item.kind === "nav") navigate(item.to);
    else if (item.kind === "product") navigate(`/admin/products?focus=${encodeURIComponent(item.sku)}`);
    else if (item.kind === "order")   navigate(`/admin/orders/${item.id}`);
    else if (item.kind === "customer") navigate(`/admin/customers/${encodeURIComponent(item.phone)}`);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="adm-palette__scrim" onMouseDown={onClose}>
      <div className="adm-palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="adm-palette__inputrow">
          <Search size={18} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setHighlight(0); }}
            placeholder="Search products, orders, or jump to a page…"
            aria-label="Command palette search"
          />
          <button className="adm-palette__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="adm-palette__body">
          {flat.length === 0 && (
            <div className="adm-palette__empty">
              {loading ? "Searching\u2026" : q ? "Nothing matches yet." : "Start typing to search across products, orders, and navigation."}
            </div>
          )}

          <ul className="adm-palette__list">
            {flat.map((item, i) => {
              const isOn = i === highlight;
              return (
                <li
                  key={item.kind + "-" + (item.id || item.sku)}
                  className={"adm-palette__item" + (isOn ? " adm-palette__item--on" : "")}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => activate(item)}
                >
                  <span className="adm-palette__icon">
                    {item.kind === "nav"      && <item.icon size={16} />}
                    {item.kind === "product"  && <Package size={16} />}
                    {item.kind === "order"    && <ShoppingCart size={16} />}
                    {item.kind === "customer" && <Users size={16} />}
                  </span>
                  <div className="adm-palette__meta">
                    {item.kind === "nav" && (
                      <>
                        <b>{item.label}</b>
                        <small>Jump to page</small>
                      </>
                    )}
                    {item.kind === "product" && (
                      <>
                        <b>{item.name}</b>
                        <small>{item.sku} · ₦{Number(item.price).toLocaleString("en-NG")} · {item.stock} in stock</small>
                      </>
                    )}
                    {item.kind === "order" && (
                      <>
                        <b>{item.id}</b>
                        <small>{item.customer_name} · ₦{Number(item.total).toLocaleString("en-NG")} · {item.status}</small>
                      </>
                    )}
                    {item.kind === "customer" && (
                      <>
                        <b>{item.name || "Unnamed"}</b>
                        <small>{item.phone} · {item.order_count} order{item.order_count === 1 ? "" : "s"} · ₦{Number(item.total_spent || 0).toLocaleString("en-NG")}</small>
                      </>
                    )}
                  </div>
                  <ArrowRight size={14} className="adm-palette__chev" />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="adm-palette__foot">
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}