import { useCallback, useEffect, useState } from "react";
import {
  fetchAllSectionsForAdmin, reorderSections, setSectionVisibility,
  patchSectionConfig, addSection, deleteSection,
} from "../lib/siteSectionsAdmin.js";

/**
 * useAdminSiteSections
 *
 * Loads every site_section (visible + hidden) for the admin, and
 * exposes mutation helpers that update local state optimistically
 * so the UI feels instant.
 *
 * All mutations refetch quietly in the background to catch any DB
 * drift (concurrent edits, RLS rejects, etc). This is the standard
 * "trust local; verify with server" pattern.
 */
export function useAdminSiteSections() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetchAllSectionsForAdmin();
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setSections(res.sections);
    setError(null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /* ---------- Reorder ---------- */
  const reorder = useCallback(async (nextOrderedIds) => {
    // Optimistic: reorder local state now
    const byId = new Map(sections.map((s) => [s.id, s]));
    const next = nextOrderedIds.map((id, i) => {
      const s = byId.get(id);
      return s ? { ...s, position: (i + 1) * 10 } : null;
    }).filter(Boolean);
    setSections(next);

    setSaving(true);
    const res = await reorderSections(nextOrderedIds);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      // Rollback via refetch
      refresh();
    }
  }, [sections, refresh]);

  /* ---------- Visibility toggle ---------- */
  const toggleVisibility = useCallback(async (id) => {
    const target = sections.find((s) => s.id === id);
    if (!target) return;
    const nextVisible = !target.is_visible;

    setSections((prev) => prev.map((s) => s.id === id ? { ...s, is_visible: nextVisible } : s));

    setSaving(true);
    const res = await setSectionVisibility(id, nextVisible);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      refresh();
    }
  }, [sections, refresh]);

  /* ---------- Config patch ---------- */
  const patchConfig = useCallback(async (id, patch) => {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, config: { ...(s.config || {}), ...patch } } : s));
    setSaving(true);
    const res = await patchSectionConfig(id, patch);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      refresh();
    }
  }, [refresh]);

  /* ---------- Add / delete ---------- */
  const add = useCallback(async ({ kind, config = {} }) => {
    setSaving(true);
    const res = await addSection({ kind, config });
    setSaving(false);
    if (!res.ok) { setError(res.error); return null; }
    setSections((prev) => [...prev, res.section].sort((a, b) => a.position - b.position));
    return res.section;
  }, []);

  const remove = useCallback(async (id) => {
    // Optimistic
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSaving(true);
    const res = await deleteSection(id);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      refresh();
    }
  }, [refresh]);

  return {
    sections,
    loading,
    error,
    saving,
    refresh,
    reorder,
    toggleVisibility,
    patchConfig,
    add,
    remove,
  };
}