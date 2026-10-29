import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { SITE } from "../config/site.js";
import { snapshotBySku, subscribeSnapshot, getSnapshotVersion } from "../lib/catalogSnapshot.js";
import { getStoredCart, saveCart, clearStoredCart } from "../utils/cartPersistence.js";
import {
  generateOrderId, saveOrder, getOrder, ORDER_STATUS,
  markOrderSynced, getUnsyncedOrders,
} from "../utils/orders.js";
import { insertOrderToSupabase } from "../lib/ordersClient.js";
import { sendOrderEmails } from "../lib/emailClient.js";
import { upsertFromCheckout } from "../lib/customerAuth.js";
import { getStoredWishlist, saveWishlist } from "../utils/wishlist.js";
import {
  getStoredComparison, saveComparison, MAX_COMPARE,
} from "../utils/comparison.js";
import { DEFAULT_SITE_SETTINGS, fetchSiteSettings, updateSiteSettings } from "../lib/siteSettings.js";
import { fetchAllOffers } from "../lib/adminOffersClient.js";

/**
 * StoreContext
 *
 * Global storefront state: theme, cart (with promotional gift lines),
 * wishlist, comparison, account, toast, order placement.
 *
 * Session 3 (2026-08-28) added:
 *   · productOffers state — loaded on mount
 *   · Cart gift auto-management via reconcileGifts()
 *   · Gift lines are marked with { isGift: true, giftFor: <parentSku>, offerId }
 *   · Gifts have price 0 (free)
 *   · Removing a parent product auto-removes its gift
 *   · Changing qty updates gift qty (if multiply_by_qty=true)
 *   · Cart-line count excludes gifts (so "2 items" counts only paid products)
 *   · Totals calculation ignores gift lines (they're free)
 */
const Ctx = createContext(null);

/** Thrown by order creation when the order can't be priced (₦0 total, missing price). */
export class OrderTotalError extends Error {}
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

/* ============================================================
   GIFT RECONCILIATION
   ============================================================
   Rebuilds the cart's gift lines from scratch based on:
     · The current non-gift cart lines (paid products)
     · The active offers table
   
   Rules:
     · For each paid product with an active, non-expired offer:
       - Add ONE gift line
       - Qty = product qty (if multiply_by_qty) OR 1 (otherwise)
     · Gift lines are always regenerated — never trust cached state
     · Marker: isGift: true, giftFor: <parentSku>, offerId
     · Price: 0 (free)
   
   Returns a NEW cart array. Non-gift lines preserved verbatim.
*/
function reconcileGifts(cart, offers) {
  if (!Array.isArray(cart) || !Array.isArray(offers)) return cart;
  const now = Date.now();

  /* Strip existing gift lines — we rebuild fresh */
  const nonGift = cart.filter((line) => !line.isGift);

  /* Index active offers by product SKU */
  const activeOffers = new Map();
  for (const offer of offers) {
    if (!offer.is_active) continue;
    if (new Date(offer.ends_at).getTime() <= now) continue;
    activeOffers.set(offer.product_sku, offer);
  }

  /* Build new gift lines */
  const gifts = [];
  for (const line of nonGift) {
    const offer = activeOffers.get(line.sku);
    if (!offer) continue;
    gifts.push({
      sku:         `gift:${offer.id}`,     // unique key, prefixed
      qty:         offer.multiply_by_qty ? line.qty : 1,
      isGift:      true,
      giftFor:     line.sku,
      offerId:     offer.id,
      offerTitle:  offer.title,
      giftDescription: offer.gift_description,
      giftImage:   offer.gift_image || null,
    });
  }

  return [...nonGift, ...gifts];
}

/* ============================================================
   PROVIDER
   ============================================================ */

export function StoreProvider({ children }) {
  const [theme, setTheme] = useState(DEFAULT_SITE_SETTINGS.theme);
  const [fontPair, setFontPair] = useState(DEFAULT_SITE_SETTINGS.font_pair);
  const [cart, setCart] = useState(() => getStoredCart());
  // Default to NO coupon. Automatic discount removed 2026-10-19.
  // Phase 3 will add GM-approved coupons via admin backend —
  // only then will discounts apply, and only when GM activates them.
  const [coupon, setCoupon] = useState("");
  const [toast, setToast] = useState(null);
  const [callConfirm, setCallConfirm] = useState(null);
  const [account, setAccount] = useState(() => loadAccount());
  const [wishlist, setWishlist] = useState(() => getStoredWishlist());
  const [compare, setCompare] = useState(() => getStoredComparison());
  const [productOffers, setProductOffers] = useState([]);

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

  /* Load promotional offers on mount. If it fails, the storefront
     still works — just without gift auto-add. Silent failure. */
  useEffect(() => {
    fetchAllOffers()
      .then((res) => {
        if (res.ok) setProductOffers(res.data || []);
      })
      .catch(() => {});
  }, []);

  /* Reconcile gifts whenever offers load or change.
     Runs once on initial offer load, then any time offers change. */
  useEffect(() => {
    if (productOffers.length === 0) return;
    setCart((c) => reconcileGifts(c, productOffers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productOffers]);

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

  /* Add a paid product to cart. Gift lines regenerate automatically
     via reconcileGifts based on the updated non-gift items. */
  const addToCart = (sku, qty = 1) => {
    setCart((c) => {
      const hit = c.find((i) => i.sku === sku && !i.isGift);
      const next = hit
        ? c.map((i) => (i.sku === sku && !i.isGift ? { ...i, qty: i.qty + qty } : i))
        : [...c, { sku, qty }];
      return reconcileGifts(next, productOffers);
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

  /* Change qty of a paid product. Blocks direct qty changes on gifts
     (they're computed). If qty <= 0, remove the product; the gift line
     will be dropped by reconcileGifts. */
  const setQty = (sku, qty) =>
    setCart((c) => {
      /* If someone tries to setQty on a gift, ignore — gifts are computed */
      const targetLine = c.find((i) => i.sku === sku);
      if (targetLine?.isGift) return c;

      const next = qty <= 0
        ? c.filter((i) => i.sku !== sku)
        : c.map((i) => (i.sku === sku && !i.isGift ? { ...i, qty } : i));
      return reconcileGifts(next, productOffers);
    });

  /* Remove a paid product. Reconciliation drops any gift attached to it. */
  const removeFromCart = (sku) =>
    setCart((c) => {
      /* Ignore direct removal of gifts — they're computed from paid products */
      const targetLine = c.find((i) => i.sku === sku);
      if (targetLine?.isGift) return c;

      const next = c.filter((i) => i.sku !== sku);
      return reconcileGifts(next, productOffers);
    });

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
   *   { added: true, removed: false }            — SKU added
   *   { added: false, removed: true }            — SKU removed
   *   { added: false, removed: false, full: true } — cap of 4 hit
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

  /* ---------- totals ----------
     Gift lines are excluded from all pricing calculations (they're free).
     Only paid product lines contribute to subtotal.

     StoreProvider sits above CatalogProvider, so prices come from the
     catalog snapshot. catalogVersion re-runs this memo when the live
     catalog lands — without it, a cart restored from localStorage was
     priced against the hardcoded fallback catalog (live SKUs → ₦0)
     and orders went out with subtotal/total 0.
  */
  const catalogVersion = useSyncExternalStore(subscribeSnapshot, getSnapshotVersion);
  const couponDiscount = (subtotal) => (coupon === SITE.welcomeCoupon.code
    ? Math.round((subtotal * SITE.welcomeCoupon.percent) / 100)
    : 0);
  const totals = useMemo(() => {
    const paidLines = cart.filter((i) => !i.isGift);
    const subtotal = paidLines.reduce(
      (s, i) => s + (snapshotBySku(i.sku)?.price ?? 0) * i.qty,
      0
    );
    const discount = couponDiscount(subtotal);
    // Delivery fee neutralised 2026-10-19 — policy pending CGCL decision.
    // Previous logic: subtotal >= SITE.freeDeliveryOver || subtotal === 0 ? 0 : 5500;
    const deliveryFee = 0;
    const installationFee = 0;
    const grand = subtotal - discount + deliveryFee + installationFee;
    return { subtotal, discount, deliveryFee, installationFee, grand };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, coupon, catalogVersion]);

  /* Count — EXCLUDES gifts. Shows "2 items" not "2 items + 2 free gifts" */
  const count = cart
    .filter((i) => !i.isGift)
    .reduce((s, i) => s + i.qty, 0);

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
    // Cart, wishlist and comparison stay — a guest can keep all three after sign-out.
  };

  /* ---------- checkout / invisible-signup ----------
     Order items INCLUDE gift lines with price 0 and a giftFor field, so:
       · The order record captures which gifts belong to which purchase
       · Warehouse can see what to physically include with the order
       · Receipt template can render gifts as separate FREE lines
  */
  const buildOrder = ({
    contact, address, payment, installation, paystackRef = null, paymentStatus = "unpaid",
    deliveryFee: deliveryFeeOverride = null, orderId = null,
  }) => {
    // Retrying payment reuses the same order id (and its original
    // createdAt) so a failed attempt doesn't leave a duplicate order.
    const previous = orderId ? getOrder(orderId) : null;
    const id = orderId || generateOrderId();
    const items = cart.map((i) => {
      if (i.isGift) {
        return {
          sku: i.sku,
          qty: i.qty,
          price: 0,
          name: i.offerTitle || "Promotional gift",
          image: i.giftImage || null,
          isGift: true,
          giftFor: i.giftFor,
          giftDescription: i.giftDescription,
          offerId: i.offerId,
        };
      }
      const p = snapshotBySku(i.sku);
      return {
        sku: i.sku,
        qty: i.qty,
        price: p?.price ?? 0,
        name: p?.name ?? i.sku,
        image: p?.image ?? null,
      };
    });

    // Price the order from the exact lines being saved, so the order
    // row always agrees with its order_items (and with what checkout
    // shows: both read the same catalog prices).
    const unpriced = items.filter((i) => !i.isGift && !(Number(i.price) > 0));
    if (unpriced.length) {
      throw new OrderTotalError(
        `We couldn't load the current price for ${unpriced.map((i) => i.name).join(", ")}. Please refresh the page and try again.`
      );
    }
    const installFee = installation ? SITE.installationFee : 0;
    const subtotal = items.reduce((s, i) => s + (i.isGift ? 0 : i.price * i.qty), 0);
    const discount = couponDiscount(subtotal);
    // Checkout.jsx computes its own deliveryFee from the admin-configurable
    // threshold (useCheckoutSettings) and passes it through here so the
    // saved order total matches what was actually charged at checkout.
    // Every other caller omits it and gets the static SITE-based totals.
    const deliveryFee = deliveryFeeOverride ?? totals.deliveryFee;
    const grand = subtotal - discount + deliveryFee + installFee;
    if (!(grand > 0)) {
      throw new OrderTotalError("Your order total is ₦0, so we can't place it. Please refresh the page and try again, or contact support.");
    }

    const existing = loadAccount();
    const sameUser = existing && normalisePhone(existing.phone) === normalisePhone(contact.phone);
    const accountCreated = !sameUser;
    const next = sameUser
      ? { ...existing, ...contact, updatedAt: new Date().toISOString() }
      : { ...contact, createdAt: new Date().toISOString() };
    persistAccount(next);
    setAccount(next);

    return {
      id,
      createdAt: previous?.createdAt || new Date().toISOString(),
      // Online orders wait in pending_payment until the server verifies
      // the charge with Paystack; Pay on Delivery is confirmed at once.
      status: paymentStatus === "pending" ? ORDER_STATUS.PENDING_PAYMENT : ORDER_STATUS.CONFIRMED,
      items,
      contact,
      address,
      payment,
      installation,
      totals: { subtotal, discount, deliveryFee, installationFee: installFee, grand },
      account: { phone: next.phone, name: next.name },
      accountCreated,
      customer_id: null, // filled by syncOrder below; may stay null if Supabase is unreachable
      paystackRef,
      // The browser only ever writes 'unpaid' or 'pending'. 'paid' is
      // set server-side by the paystack-verify / paystack-webhook functions.
      paymentStatus: paymentStatus === "pending" ? "pending" : "unpaid",
      // syncedAt gets stamped when the Supabase insert lands
    };
  };

  // Silently create-or-find the customer record, link this order to
  // it, then upsert the order into Supabase. If the customer link
  // fails the order still syncs (just without a customer_id). Resolves
  // with the insert result; never rejects.
  const syncOrder = (order) =>
    upsertFromCheckout({ phone: order.contact.phone, name: order.contact.name, email: order.contact.email })
      .then((res) => (res.ok && res.id ? { ...order, customer_id: res.id } : order))
      .catch(() => order)
      .then((o) => {
        if (o !== order) saveOrder(o);
        return insertOrderToSupabase(o).then((r) => {
          if (r.ok) markOrderSynced(o.id);
          return r;
        });
      });

  // Pay on Delivery (and any flow that doesn't go through Paystack).
  // Throws OrderTotalError (nothing saved) if the order can't be priced.
  // Write-through cache: localStorage now, Supabase in background.
  // The customer never waits on the network for their confirmation.
  const placeOrder = ({ paystackRef: _ignoredRef, paymentStatus: _ignoredStatus, ...args }) => {
    const order = buildOrder({ ...args, paystackRef: null, paymentStatus: "unpaid" });
    saveOrder(order);
    clearCart();

    // Fire order emails (customer confirmation + admin notification)
    // in the background. Non-blocking, silent failure. If Resend
    // isn't configured on the server, the function returns
    // { skipped: true } and we log-info once.
    sendOrderEmails(order).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[placeOrder] email dispatch error:", err);
    });

    syncOrder(order);
    return order.id;
  };

  // Card / Transfer / USSD: the order must exist in Supabase (as
  // 'pending') BEFORE the Paystack popup opens, so the server can
  // look it up when verifying. Unlike placeOrder this waits for the
  // insert, keeps the cart (the customer may retry or switch to POD)
  // and sends no emails yet.
  const createPendingPaymentOrder = async ({ paystackRef, ...args }) => {
    let order;
    try {
      order = buildOrder({ ...args, paystackRef, paymentStatus: "pending" });
    } catch (err) {
      return { ok: false, error: err.message, blocked: err instanceof OrderTotalError };
    }
    saveOrder(order);
    const res = await syncOrder(order);
    return res.ok ? { ok: true, order } : { ok: false, error: res.error };
  };

  // Called only after the SERVER has confirmed payment with Paystack.
  // Mirrors the server's answer (paid + confirmed) into the local cache
  // for display and fires the order emails. Checkout also clears the
  // cart; "Pay now" on the order page passes clearCart: false and the
  // order it loaded (it may not be in this device's localStorage).
  const completePaidOrder = (orderId, { clearCart: shouldClearCart = true, order: fallback = null } = {}) => {
    const order = getOrder(orderId) || fallback;
    if (!order) return;
    const paid = { ...order, paymentStatus: "paid", status: ORDER_STATUS.CONFIRMED };
    saveOrder(paid);
    if (shouldClearCart) clearCart();
    sendOrderEmails(paid).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[completePaidOrder] email dispatch error:", err);
    });
  };

  return (
    <Ctx.Provider
      value={{
        theme, setTheme, fontPair, saveAppearance,
        cart, addToCart, setQty, removeFromCart, clearCart,
        coupon, setCoupon, totals, count,
        toast, dismissToast,
        callConfirm, requestCall, cancelCall, confirmCall,
        account, signIn, signOut, placeOrder, createPendingPaymentOrder, completePaidOrder,
        wishlist, toggleWishlist, isInWishlist, wishlistCount,
        compare, toggleCompare, isInComparison, removeFromComparison, clearComparison, compareCount,
        productOffers,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => useContext(Ctx);