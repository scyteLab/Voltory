import { useCallback, useEffect, useState } from "react";
import {
  fetchAllCategories, fetchCategoryProductCounts,
  createCategory, updateCategory, deleteCategory,
} from "../lib/categoriesAdmin.js";

/**
 * useAdminCategories — exposes list, product counts, and mutations
 * for the /admin/catalog/categories page. All mutations return their
 * result so the caller can show errors inline in the modal.
 */
export function useAdminCategories() {
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [catRes, cntRes] = await Promise.all([
      fetchAllCategories(),
      fetchCategoryProductCounts(),
    ]);
    setLoading(false);
    if (catRes.ok) {
      setCategories(catRes.categories);
      setError(null);
    } else {
      setError(catRes.error);
    }
    if (cntRes.ok) setCounts(cntRes.counts);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = useCallback(async (input) => {
    const res = await createCategory(input);
    if (res.ok) {
      setCategories((prev) => [...prev, res.category].sort((a, b) => a.label.localeCompare(b.label)));
    }
    return res;
  }, []);

  const update = useCallback(async (id, patch) => {
    const res = await updateCategory(id, patch);
    if (res.ok && res.category) {
      setCategories((prev) => prev.map((c) => c.id === id ? res.category : c)
        .sort((a, b) => a.label.localeCompare(b.label)));
    }
    return res;
  }, []);

  const remove = useCallback(async (id) => {
    const res = await deleteCategory(id);
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setCounts((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
    return res;
  }, []);

  return { categories, counts, loading, error, refresh, create, update, remove };
}