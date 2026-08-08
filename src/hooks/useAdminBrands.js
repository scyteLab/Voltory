import { useCallback, useEffect, useState } from "react";
import {
  fetchAllBrands, fetchBrandProductCounts,
  createBrand, updateBrand, deleteBrand,
} from "../lib/brandsAdmin.js";

/**
 * useAdminBrands \u2014 mirrors useAdminCategories in shape.
 * `counts` is keyed by brand NAME (not id), because products link by name.
 */
export function useAdminBrands() {
  const [brands, setBrands] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [brRes, cntRes] = await Promise.all([
      fetchAllBrands(),
      fetchBrandProductCounts(),
    ]);
    setLoading(false);
    if (brRes.ok) {
      setBrands(brRes.brands);
      setError(null);
    } else {
      setError(brRes.error);
    }
    if (cntRes.ok) setCounts(cntRes.counts);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (input) => {
    // Pass current brands so createBrand can check name-uniqueness
    const res = await createBrand(input, brands);
    if (res.ok) {
      setBrands((prev) => [...prev, res.brand].sort((a, b) => a.name.localeCompare(b.name)));
    }
    return res;
  }, [brands]);

  const update = useCallback(async (id, patch) => {
    const res = await updateBrand(id, patch);
    if (res.ok && res.brand) {
      setBrands((prev) => prev.map((b) => b.id === id ? res.brand : b));
    }
    return res;
  }, []);

  const remove = useCallback(async (brand) => {
    const res = await deleteBrand(brand);
    if (res.ok) {
      setBrands((prev) => prev.filter((b) => b.id !== brand.id));
      setCounts((prev) => { const n = { ...prev }; delete n[brand.name]; return n; });
    }
    return res;
  }, []);

  return { brands, counts, loading, error, refresh, create, update, remove };
}