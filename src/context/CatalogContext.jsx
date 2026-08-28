import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadCatalog } from "../lib/catalogClient.js";
import { setSnapshot } from "../lib/catalogSnapshot.js";
import {
  supabase, supabaseConfigured,
} from "../lib/supabaseClient.js";
import { fetchAllCollections } from "../lib/collectionsClient.js";
import {
  fetchAllOffers,
  createOffer as apiCreateOffer,
  updateOffer as apiUpdateOffer,
  deleteOffer as apiDeleteOffer,
  toggleOfferActive as apiToggleOfferActive,
} from "../lib/adminOffersClient.js";

/**
 * CatalogContext
 *
 * Owns storefront catalog state (products, categories, brands),
 * plus admin-managed collections and product offers. Serves
 * both storefront reads and admin write-through operations.
 *
 * Session (2026-08-28) added:
 *   · productOffers state (list of all offers with product join)
 *   · loadOffers() to hydrate from DB
 *   · upsertOffer(payload)   — create or update, matches Collections pattern
 *   · removeOffer(id)         — delete
 *   · setOfferActive(id, on)  — pause/resume without deleting
 *   · getOfferBySku(sku)      — helper for storefront product page
 *
 * Rest of file preserved verbatim.
 */

const CatalogCtx = createContext(null);

export function CatalogProvider({ children }) {
  const [products, setProducts]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands]         = useState([]);
  const [collections, setCollections] = useState([]);
  const [productOffers, setProductOffers] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [source, setSource]         = useState("pending");
  const initialLoadDone = useRef(false);

  /* ---- Initial load ---- */

  async function reload() {
    setLoading(true);
    setError(null);

    const bundle = await loadCatalog();
    setProducts(bundle.products);
    setCategories(bundle.categories);
    setBrands(bundle.brands);
    setSource(bundle.source);
    if (bundle.error) setError(bundle.error);

    /* Sync snapshot for non-hook consumers */
    setSnapshot({
      products:   bundle.products,
      categories: bundle.categories,
      brands:     bundle.brands,
    });

    /* Load collections (best-effort, silent on failure) */
    if (supabaseConfigured) {
      const collectionsRes = await fetchAllCollections();
      if (collectionsRes.ok) setCollections(collectionsRes.data || []);
    }

    /* Load offers (best-effort, silent on failure) */
    if (supabaseConfigured) {
      const offersRes = await fetchAllOffers();
      if (offersRes.ok) setProductOffers(offersRes.data || []);
    }

    setLoading(false);
    initialLoadDone.current = true;
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================
     PRODUCT operations (admin)
     ============================================================ */

  async function upsertProduct(payload) {
    if (!supabaseConfigured) throw new Error("Supabase not configured.");
    const { data, error: err } = await supabase
      .from("products")
      .upsert(payload, { onConflict: "sku" })
      .select()
      .single();
    if (err) throw err;

    /* Local state update: replace or add */
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.sku === data.sku);
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...next[idx], ...data };
      } else {
        next = [data, ...prev];
      }
      /* Sync snapshot */
      setSnapshot({ products: next, categories, brands });
      return next;
    });

    return data;
  }

  async function deleteProduct(sku) {
    if (!supabaseConfigured) throw new Error("Supabase not configured.");
    const { error: err } = await supabase
      .from("products")
      .delete()
      .eq("sku", sku);
    if (err) throw err;

    setProducts((prev) => {
      const next = prev.filter((p) => p.sku !== sku);
      setSnapshot({ products: next, categories, brands });
      return next;
    });
  }

  /* ============================================================
     COLLECTION operations (admin)
     ============================================================ */

  async function upsertCollection(payload) {
    if (!supabaseConfigured) throw new Error("Supabase not configured.");
    const isUpdate = !!payload.id;
    const op = isUpdate
      ? supabase.from("collections").update(payload).eq("id", payload.id)
      : supabase.from("collections").insert(payload);
    const { data, error: err } = await op.select().single();
    if (err) throw err;

    setCollections((prev) => {
      const idx = prev.findIndex((c) => c.id === data.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...data };
        return next;
      }
      return [data, ...prev];
    });

    return data;
  }

  async function deleteCollection(id) {
    if (!supabaseConfigured) throw new Error("Supabase not configured.");
    const { error: err } = await supabase
      .from("collections")
      .delete()
      .eq("id", id);
    if (err) throw err;

    setCollections((prev) => prev.filter((c) => c.id !== id));
  }

  function _setCollections(list) {
    setCollections(list);
  }

  /* ============================================================
     OFFER operations (admin) — NEW in Session 2
     ============================================================ */

  async function loadOffers() {
    if (!supabaseConfigured) return;
    const res = await fetchAllOffers();
    if (res.ok) setProductOffers(res.data || []);
  }

  async function upsertOffer(payload) {
    const isUpdate = !!payload.id;
    const res = isUpdate
      ? await apiUpdateOffer(payload.id, payload)
      : await apiCreateOffer(payload);

    if (!res.ok) throw new Error(res.error);

    /* Refresh from DB to get the joined product data. Simpler
       than reconstructing the join client-side. */
    await loadOffers();

    return res.data;
  }

  async function removeOffer(id) {
    const res = await apiDeleteOffer(id);
    if (!res.ok) throw new Error(res.error);
    setProductOffers((prev) => prev.filter((o) => o.id !== id));
  }

  async function setOfferActive(id, isActive) {
    const res = await apiToggleOfferActive(id, isActive);
    if (!res.ok) throw new Error(res.error);
    setProductOffers((prev) =>
      prev.map((o) => (o.id === id ? { ...o, is_active: isActive } : o))
    );
  }

  /* Storefront helper: find an offer for a specific product SKU.
     Returns the offer only if it's active and not expired. */
  function getOfferBySku(sku) {
    if (!sku) return null;
    const now = Date.now();
    return productOffers.find(
      (o) =>
        o.product_sku === sku &&
        o.is_active &&
        new Date(o.ends_at).getTime() > now
    ) || null;
  }

  /* ============================================================
     HELPERS (storefront reads)
     ============================================================ */

  const byCategory = (catId) => products.filter((p) => p.category === catId);
  const byBrand    = (brand) => products.filter((p) => p.brand === brand);
  const bySku      = (sku)   => products.find((p) => p.sku === sku) || null;
  const bySlug     = (slug)  => products.find((p) => p.slug === slug) || null;
  const byId       = (catId) => categories.find((c) => c.id === catId) || null;
  const findBrand  = (name)  => brands.find((b) => b.name === name) || null;

  const value = useMemo(
    () => ({
      /* State */
      products, categories, brands, collections, productOffers,
      loading, error, source,

      /* Reload */
      reload,

      /* Product CRUD */
      upsertProduct, deleteProduct,

      /* Collection CRUD */
      upsertCollection, deleteCollection, _setCollections,

      /* Offer CRUD */
      loadOffers, upsertOffer, removeOffer, setOfferActive,
      getOfferBySku,

      /* Helpers */
      byCategory, byBrand, bySku, bySlug, byId, findBrand,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, categories, brands, collections, productOffers, loading, error, source]
  );

  return <CatalogCtx.Provider value={value}>{children}</CatalogCtx.Provider>;
}

export function useCatalog() {
  const ctx = useContext(CatalogCtx);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
}