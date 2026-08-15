import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PackagePlus, RefreshCw, Upload } from "lucide-react";
import { useCatalog, fetchProductBySku } from "../../hooks/useCatalog.js";
import CatalogFilters from "../../components/admin/CatalogFilters.jsx";
import ProductTable from "../../components/admin/ProductTable.jsx";
import ProductEditPanel from "../../components/admin/ProductEditPanel.jsx";
import BulkActionBar from "../../components/admin/BulkActionBar.jsx";

/**
 * Catalog Products page — the operator's primary workhorse.
 *
 * Layout:
 *   [ header row: title + Refresh + Add Product ]
 *   [ filters row: search + selects + active chips ]
 *   [ table col | edit panel col ]
 *
 * Query-string protocol:
 *   ?new=1        — open a blank edit panel
 *   ?focus=SKU    — open the given product (from ⌘K palette)
 *
 * Selection: bulk-select checkboxes populate a Set<sku>. Bulk
 * actions themselves come in a follow-up session; scaffolding is
 * here so the wiring is done.
 */
export default function CatalogProducts() {
  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState({
    search: "", categoryId: "", brandId: "", status: "", stockBand: "",
    sort: { col: "updated_at", dir: "desc" },
    page: 1, pageSize: 10,
  });

  const {
    rows, total, brands, categories, loading, error,
    refresh, upsertProduct, deleteProduct,
    bulkDelete, bulkSetStatus,
  } = useCatalog(filters);

  const [editMode, setEditMode] = useState("closed"); // closed | new | edit
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState(new Set());

  // Deep-link handling: run once on mount and again if params change
  useEffect(() => {
    if (params.get("new") === "1") {
      openNewProduct();
      // Strip the ?new=1 so a refresh doesn't re-open a blank form
      const p = new URLSearchParams(params);
      p.delete("new");
      setParams(p, { replace: true });
      return;
    }
    const focusSku = params.get("focus");
    if (focusSku) {
      (async () => {
        const p = await fetchProductBySku(focusSku).catch(() => null);
        if (p) {
          setEditing(p);
          setEditMode("edit");
        }
      })();
      const p = new URLSearchParams(params);
      p.delete("focus");
      setParams(p, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewProduct = useCallback(() => {
    setEditing(null);
    setEditMode("new");
  }, []);

  const openEditProduct = useCallback((row) => {
    setEditing(row);
    setEditMode("edit");
  }, []);

  const closePanel = useCallback(() => {
    setEditMode("closed");
    setEditing(null);
  }, []);

  const handleSave = useCallback(async (payload) => {
    setSaving(true);
    try {
      const saved = await upsertProduct(payload);
      // After a fresh create, flip into edit mode on the saved row
      if (editMode === "new") {
        setEditing(saved);
        setEditMode("edit");
      } else {
        setEditing(saved);
      }
    } finally {
      setSaving(false);
    }
  }, [upsertProduct, editMode]);

  const handleDelete = useCallback(async (sku) => {
    await deleteProduct(sku);
    closePanel();
  }, [deleteProduct, closePanel]);

  const toggleSelect = useCallback((sku, on) => {
    setSelectedSkus((prev) => {
      const next = new Set(prev);
      if (on) next.add(sku); else next.delete(sku);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback((on) => {
    setSelectedSkus((prev) => {
      if (!on) {
        const next = new Set(prev);
        rows.forEach((r) => next.delete(r.sku));
        return next;
      }
      const next = new Set(prev);
      rows.forEach((r) => next.add(r.sku));
      return next;
    });
  }, [rows]);

  const focusedSku = editing?.sku || null;
  const showPanel = editMode !== "closed";

  const selectedList = useMemo(() => Array.from(selectedSkus), [selectedSkus]);

  const handleBulkDelete = useCallback(async () => {
    await bulkDelete(selectedList);
    setSelectedSkus(new Set());
    // If the currently-open product was among them, close the panel
    if (focusedSku && selectedList.includes(focusedSku)) closePanel();
  }, [bulkDelete, selectedList, focusedSku, closePanel]);

  const handleBulkStatus = useCallback(async (status) => {
    await bulkSetStatus(selectedList, status);
    setSelectedSkus(new Set());
  }, [bulkSetStatus, selectedList]);

  return (
    <div className="adm-page adm-catalog">
      <header className="adm-page__head">
        <div>
          <h1>Catalog Management</h1>
          <p>Manage products, inventory, and category associations across all brands.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="adm-btn adm-btn--secondary" onClick={refresh}>
            <RefreshCw size={13} /> Refresh
          </button>
          <Link to="/admin/products/import" className="adm-btn adm-btn--secondary">
            <Upload size={13} /> Bulk import
          </Link>
          <button className="adm-btn adm-btn--primary" onClick={openNewProduct}>
            <PackagePlus size={14} /> Add Product
          </button>
        </div>
      </header>

      <CatalogFilters
        filters={filters}
        onChange={setFilters}
        brands={brands}
        categories={categories}
        total={total}
      />

      {error && (
        <div className="adm-empty adm-empty--err">
          <b>Failed to load catalog.</b>
          <p>{error}</p>
          <button className="adm-btn adm-btn--secondary" onClick={refresh}>
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      <BulkActionBar
        count={selectedSkus.size}
        onSetStatus={handleBulkStatus}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedSkus(new Set())}
      />

      <div className={"adm-catalog__split" + (showPanel ? " adm-catalog__split--panel-open" : "")}>
        <div className="adm-catalog__tblcol">
          <ProductTable
            rows={rows}
            total={total}
            loading={loading}
            page={filters.page}
            pageSize={filters.pageSize}
            onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
            sort={filters.sort}
            onSortChange={(s) => setFilters((f) => ({ ...f, sort: s, page: 1 }))}
            focusedSku={focusedSku}
            onSelectRow={openEditProduct}
            selectedSkus={selectedSkus}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            brands={brands}
            categories={categories}
          />
        </div>
        {showPanel && (
          <ProductEditPanel
            mode={editMode}
            product={editing}
            brands={brands}
            categories={categories}
            saving={saving}
            onSave={handleSave}
            onCancel={closePanel}
            onDelete={handleDelete}
          />
        )}
      </div>
    </div>
  );
}