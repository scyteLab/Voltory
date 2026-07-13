import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SITE } from "../config/site.js";
import { bySku } from "../data/products.js";
import { getStoredCart, saveCart, clearStoredCart } from "../utils/cartPersistence.js";
import { generateOrderId, saveOrder, ORDER_STATUS } from "../utils/orders.js";
import { getStoredWishlist, saveWishlist } from "../utils/wishlist.js";
import {
  getStoredComparison, saveComparison, MAX_COMPARE,
} from "../utils/comparison.js";

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
  const [theme, setTheme] = useState(SITE.defaultTheme);
  const [cart, setCart] = useState(() => getStoredCart());
  const [coupon, setCoupon] = useState(SITE.welcomeCoupon.code);
  const [toast, setToast] = useState(null);
  const [account, setAccount] = useState(() => loadAccount());
  const [wishlist, setWishlist] = useState(() => getStoredWishlist());
  const [compare, setCompare] = useState(() => getStoredComparison());

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { saveCart(cart); }, [cart]);
  useEffect(() => { saveWishlist(wishlist); }, [wishlist]);
  useEffect(() => { saveComparison(compare); }, [compare]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

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
    const subtotal = cart.reduce((s, i) => s + (bySku(i.sku)?.price ?? 0) * i.qty, 0);
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
      const p = bySku(i.sku);
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
    };

    saveOrder(order);
    clearCart();
    return id;
  };

  return (
    <Ctx.Provider
      value={{
        theme, setTheme,
        cart, addToCart, setQty, removeFromCart, clearCart,
        coupon, setCoupon, totals, count,
        toast, dismissToast,
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