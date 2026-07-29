import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SITE } from "../config/site.js";
import { snapshotBySku } from "../lib/catalogSnapshot.js";
import { getStoredCart, saveCart, clearStoredCart } from "../utils/cartPersistence.js";
import {
  generateOrderId, saveOrder, ORDER_STATUS,
  markOrderSynced, getUnsyncedOrders,
} from "../utils/orders.js";
import { insertOrderToSupabase } from "../lib/ordersClient.js";
import { upsertFromCheckout } from "../lib/customerAuth.js";
import { getStoredWishlist, saveWishlist } from "../utils/wishlist.js";
import {
  getStoredComparison, saveComparison, MAX_COMPARE,
} from "../utils/comparison.js";
import { DEFAULT_SITE_SETTINGS, fetchSiteSettings, updateSiteSettings } from "../lib/siteSettings.js";

/**
 * Global store state: theme, cart, toast, account, wishlist, comparison.
 * All four persistent slices (cart, account, wishlist, comparison) survive
 * page refreshes via localStorage.
 *
 * Account is keyed by phone number. Both signup paths (invisible
 * at checkout, explicit at /signup) hit the same record \u2014 the
 * second path simply merges its fields onto whatever exists.
 */
const Ctx = createContext(null);
const ACCOUNT_KEY = "voltory_account";

function loadAccount() {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistAccount(acc) {
  try {
    if (acc) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
    else localStorage.removeItem(ACCOUNT_KEY);
  } catch {
    /* noop */
  }
}

export function normalisePhone(p) {
  return (p || "").replace(/\D/g, "");
}

export function StoreProvider({ children }) {
  const [theme, setTheme] = useState(DEFAULT_SITE_SETTINGS.theme);
  const [fontPair, setFontPair] = useState(DEFAULT_SITE_SETTINGS.font_pair);
  const [cart, setCart] = useState(() => getStoredCart());
  const [coupon, setCoupon] = useState(SITE.welcomeCoupon.code);
  const [toast, setToast] = useState(null);
  const [callConfirm, setCallConfirm] = useState(null);
  const [account, setAccount] = useState(() => loadAccount());
  const [wishlist, setWishlist] = useState(() => getStoredWishlist());
  const [compare, setCompare] = useState(() => getStoredComparison());

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { document.documentElement.dataset.fontPair = fontPair; }, [fontPair]);

  // Shared across every visitor (not per-browser like the rest of this
  // file) — admin's Appearance settings live in Supabase. Falls back
  // to the defaults above if Supabase isn't reachable/configured yet,
  // so the storefront never breaks over an appearance fetch failing.
  useEffect(() => {
    fetchSiteSettings()
      .then((s) => { setTheme(s.theme); setFontPair(s.font_pair); })
      .catch(() => {});
  }, []);

  useEffect(() => { saveCart(cart); }, [cart]);
  useEffect(() => { saveWishlist(wishlist); }, [wishlist]);
  useEffect(() => { saveComparison(compare); }, [compare]);

  // Boot-time sweep: retry any locally-persisted orders that failed to
  // reach Supabase last time (customer was offline, RLS blip, network
  // flake, etc). Runs once, silently. If Supabase still isn't reachable,
  // orders wait for the next boot.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // A tiny delay so we don't compete with the initial page render
      await new Promise((r) => setTimeout(r, 1200));
      if (cancelled) return;
      const pending = getUnsyncedOrders();
      for (const order of pending) {
        if (cancelled) break;
        const res = await insertOrderToSupabase(order);
        if (res.ok) markOrderSynced(order.id);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /* ---------- appearance (admin-controlled, shared site-wide) ---------- */
  const saveAppearance = async ({ theme: t, font_pair: f }) => {
    const saved = await updateSiteSettings({ theme: t, font_pair: f });
    setTheme(saved.theme);
    setFontPair(saved.font_pair);
    return saved;
  };

  /* ---------- cart ---------- */
  const addToCart = (sku, qty = 1) => {
    setCart((c) => {
      const hit = c.find((i) => i.sku === sku);
      return hit
        ? c.map((i) => (i.sku === sku ? { ...i, qty: i.qty + qty } : i))
        : [...c, { sku, qty }];
    });
    setToast({ sku, qty, ts: Date.now() });
  };
  const dismissToast = () => setToast(null);

  /* ---------- click-to-call ---------- */
  // Every "tel:" link in the app routes through here instead of
  // navigating straight away, so a friendly Yes/No always sits
  // between the tap and actually opening the phone dialer.
  const requestCall = (phone) => setCallConfirm({ phone });
  const cancelCall = () => setCallConfirm(null);
  const confirmCall = () => {
    if (callConfirm) window.location.href = `tel:${callConfirm.phone.replace(/\s/g, "")}`;
    setCallConfirm(null);
  };
  const setQty = (sku, qty) =>
    setCart((c) =>
      qty <= 0 ? c.filter((i) => i.sku !== sku) : c.map((i) => (i.sku === sku ? { ...i, qty } : i))
    );
  const removeFromCart = (sku) => setCart((c) => c.filter((i) => i.sku !== sku));
  const clearCart = () => {
    setCart([]);
    clearStoredCart();
  };

  /* ---------- wishlist ---------- */
  const toggleWishlist = (sku) => {
    setWishlist((w) => (w.includes(sku) ? w.filter((s) => s !== sku) : [sku, ...w]));
  };
  const isInWishlist = (sku) => wishlist.includes(sku);
  const wishlistCount = wishlist.length;

  /* ---------- comparison ---------- */
  /**
   * Toggle a SKU in the comparison set. Returns:
   *   { added: true, removed: false }            \u2014 SKU added
   *   { added: false, removed: true }            \u2014 SKU removed
   *   { added: false, removed: false, full: true } \u2014 cap of 4 hit
   */
  const toggleCompare = (sku) => {
    const present = compare.includes(sku);
    if (present) {
      setCompare((c) => c.filter((s) => s !== sku));
      return { added: false, removed: true };
    }
    if (compare.length >= MAX_COMPARE) {
      return { added: false, removed: false, full: true };
    }
    setCompare((c) => [...c, sku]);
    return { added: true, removed: false };
  };
  const isInComparison = (sku) => compare.includes(sku);
  const removeFromComparison = (sku) =>
    setCompare((c) => c.filter((s) => s !== sku));
  const clearComparison = () => setCompare([]);
  const compareCount = compare.length;

  /* ---------- totals ---------- */
  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, i) => s + (snapshotBySku(i.sku)?.price ?? 0) * i.qty, 0);
    const discount = coupon === SITE.welcomeCoupon.code
      ? Math.round((subtotal * SITE.welcomeCoupon.percent) / 100)
      : 0;
    const deliveryFee = subtotal >= SITE.freeDeliveryOver || subtotal === 0 ? 0 : 5500;
    const installationFee = 0;
    const grand = subtotal - discount + deliveryFee + installationFee;
    return { subtotal, discount, deliveryFee, installationFee, grand };
  }, [cart, coupon]);

  const count = cart.reduce((s, i) => s + i.qty, 0);

  /* ---------- auth ---------- */
  const signIn = (incoming) => {
    const existing = loadAccount();
    const sameUser = existing && normalisePhone(existing.phone) === normalisePhone(incoming.phone);
    const next = sameUser
      ? { ...existing, ...incoming, updatedAt: new Date().toISOString() }
      : { ...incoming, createdAt: new Date().toISOString() };
    persistAccount(next);
    setAccount(next);
    return next;
  };

  const signOut = () => {
    persistAccount(null);
    setAccount(null);
    // Cart, wishlist and comparison stay \u2014 a guest can keep all three after sign-out.
  };

  /* ---------- checkout / invisible-signup ---------- */
  const placeOrder = ({ contact, address, payment, installation }) => {
    const id = generateOrderId();
    const items = cart.map((i) => {
      const p = snapshotBySku(i.sku);
      return {
        sku: i.sku,
        qty: i.qty,
        price: p?.price ?? 0,
        name: p?.name ?? i.sku,
        image: p?.image ?? null,
      };
    });

    const installFee = installation ? SITE.installationFee : 0;
    const subtotal = totals.subtotal;
    const discount = totals.discount;
    const deliveryFee = totals.deliveryFee;
    const grand = subtotal - discount + deliveryFee + installFee;

    const existing = loadAccount();
    const sameUser = existing && normalisePhone(existing.phone) === normalisePhone(contact.phone);
    const accountCreated = !sameUser;
    const next = sameUser
      ? { ...existing, ...contact, updatedAt: new Date().toISOString() }
      : { ...contact, createdAt: new Date().toISOString() };
    persistAccount(next);
    setAccount(next);

    const order = {
      id,
      createdAt: new Date().toISOString(),
      status: ORDER_STATUS.CONFIRMED,
      items,
      contact,
      address,
      payment,
      installation,
      totals: { subtotal, discount, deliveryFee, installationFee: installFee, grand },
      account: { phone: next.phone, name: next.name },
      accountCreated,
      customer_id: null, // filled by the silent upsert below; may stay null if Supabase is unreachable
      // syncedAt gets stamped when the background insert lands
    };

    // Write-through cache: localStorage now, Supabase in background.
    // The customer never waits on the network for their confirmation.
    saveOrder(order);
    clearCart();

    // Silently create-or-find the customer record and link this order
    // to it. Fire in the background \u2014 if it fails, the order still
    // exists (just without a customer_id), and next boot will retry
    // the order sync but not the customer link. Acceptable at this
    // scale; Session 32 formalises with real auth.
    upsertFromCheckout({ phone: contact.phone, name: contact.name, email: contact.email })
      .then((res) => {
        if (res.ok && res.id) {
          // Attach to the local order so the sync sweep has it
          const patched = { ...order, customer_id: res.id };
          saveOrder(patched);
          insertOrderToSupabase(patched).then((r) => {
            if (r.ok) markOrderSynced(id);
          });
        } else {
          // Couldn't create the customer \u2014 still sync the order without a link
          insertOrderToSupabase(order).then((r) => {
            if (r.ok) markOrderSynced(id);
          });
        }
      })
      .catch(() => {
        insertOrderToSupabase(order).then((r) => {
          if (r.ok) markOrderSynced(id);
        });
      });

    return id;
  };

  return (
    <Ctx.Provider
      value={{
        theme, setTheme, fontPair, saveAppearance,
        cart, addToCart, setQty, removeFromCart, clearCart,
        coupon, setCoupon, totals, count,
        toast, dismissToast,
        callConfirm, requestCall, cancelCall, confirmCall,
        account, signIn, signOut, placeOrder,
        wishlist, toggleWishlist, isInWishlist, wishlistCount,
        compare, toggleCompare, isInComparison, removeFromComparison, clearComparison, compareCount,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);