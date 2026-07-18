import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Pencil, Plus, Search, Trash2, X,
} from "lucide-react";
import {
  deleteProduct, fetchBrands, fetchCategories, fetchProducts, saveProduct,
} from "../../lib/adminCatalog.js";
import { naira, stockState } from "../../utils/format.js";

const PAGE_SIZE = 10;

const STATUS_BADGE = {
  active: { label: "Active", cls: "adm-badge--ok" },
  inactive: { label: "Inactive", cls: "adm-badge--mut" },
};
const STOCK_BADGE = {
  ok: { label: "In Stock", cls: "adm-text-ok" },
  low: { label: "Low Stock", cls: "adm-text-warn" },
  out: { label: "Out of Stock", cls: "adm-text-err" },
};

const slugify = (s) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const emptyDraft = {
  sku: "", slug: "", name: "", brand: "", model: "", category: "",
  image: "", price: "", was: "", stock: 0, status: "active",
  rating: 0, reviews: 0, questions: 0, badge: null, icon: null,
  tags: [], hp: null, inverter: null, litres: null, doors: null,
  highlights: [], specs: [], description: "",
};

export default function CatalogProducts() {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fBrand, setFBrand] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [page, setPage] = useState(1);

  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  function load() {
    Promise.all([fetchProducts(), fetchCategories(), fetchBrands()])
      .then(([p, c, b]) => { setProducts(p); setCategories(c); setBrands(b); })
      .catch((e) => setError(e.message));
  }
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
      if (fCategory && p.category !== fCategory) return false;
      if (fBrand && p.brand !== fBrand) return false;
      if (fStatus && p.status !== fStatus) return false;
      return true;
    });
  }, [products, search, fCategory, fBrand, fStatus]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetFilters(fn) {
    return (v) => { fn(v); setPage(1); };
  }

  function openAdd() {
    setDraft(emptyDraft);
    setFormError(null);
    setPanelOpen(true);
  }
  function openEdit(p) {
    setDraft({ ...p, price: String(p.price), was: p.was == null ? "" : String(p.was) });
    setFormError(null);
    setPanelOpen(true);
  }

  async function onDelete(p) {
    if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
    try {
      await deleteProduct(p.sku);
      setProducts((list) => list.filter((x) => x.sku !== p.sku));
    } catch (e) {
      alert(`Couldn't delete: ${e.message}`);
    }
  }

  async function onSave(e) {
    e.preventDefault();
    setFormError(null);
    if (!draft.sku.trim()) return setFormError("SKU is required.");
    if (!draft.name.trim()) return setFormError("Product title is required.");
    if (!draft.brand) return setFormError("Pick a brand.");
    if (!draft.category) return setFormError("Pick a category.");
    if (!draft.price || Number(draft.price) <= 0) return setFormError("Enter a valid selling price.");

    const payload = {
      ...draft,
      slug: draft.slug || slugify(draft.name),
      price: Number(draft.price),
      was: draft.was === "" ? null : Number(draft.was),
      stock: Number(draft.stock) || 0,
      hp: draft.hp === "" || draft.hp == null ? null : Number(draft.hp),
      litres: draft.litres === "" || draft.litres == null ? null : Number(draft.litres),
      doors: draft.doors === "" || draft.doors == null ? null : Number(draft.doors),
    };

    setSaving(true);
    try {
      const saved = await saveProduct(payload);
      setProducts((list) => {
        const exists = list.some((p) => p.sku === saved.sku);
        return exists ? list.map((p) => (p.sku === saved.sku ? saved : p)) : [saved, ...list];
      });
      setPanelOpen(false);
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="adm-error">Couldn't load catalog: {error}</p>;

  return (
    <div className="adm-page">
      <div className="adm-page__head">
        <div>
          <p className="adm-crumb">Dashboard / Catalog Management</p>
          <h1>Catalog Management</h1>
          <p className="adm-page__sub">Manage products, inventory, and categories.</p>
        </div>
        <button className="adm-btn adm-btn--primary" onClick={openAdd}>
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="adm-table-card">
        <div className="adm-table-toolbar">
          <label className="adm-search adm-search--inline">
            <Search size={15} />
            <input
              placeholder="Search products…"
              value={search}
              onChange={(e) => resetFilters(setSearch)(e.target.value)}
            />
          </label>
          <select value={fCategory} onChange={(e) => resetFilters(setFCategory)(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={fBrand} onChange={(e) => resetFilters(setFBrand)(e.target.value)}>
            <option value="">All Brands</option>
            {brands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => resetFilters(setFStatus)(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {!products ? (
          <p className="adm-loading"><Loader2 size={16} className="adm-spin" /> Loading…</p>
        ) : (
          <>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((p) => {
                    const st = stockState(p.stock);
                    const cat = categories.find((c) => c.id === p.category);
                    const status = STATUS_BADGE[p.status] || STATUS_BADGE.active;
                    return (
                      <tr key={p.sku}>
                        <td className="adm-table__product">
                          <span className="adm-table__thumb">
                            {p.image && <img src={p.image} alt="" />}
                          </span>
                          <span>
                            <b>{p.name}</b>
                            <small>SKU: {p.sku}</small>
                          </span>
                        </td>
                        <td>{p.brand}</td>
                        <td>{cat?.label || p.category}</td>
                        <td>{naira(p.price)}</td>
                        <td>
                          <span className={STOCK_BADGE[st].cls}>{STOCK_BADGE[st].label}</span>
                          <br /><small>{p.stock} units</small>
                        </td>
                        <td><span className={"adm-badge " + status.cls}>{status.label}</span></td>
                        <td className="adm-table__actions">
                          <button aria-label="Edit" onClick={() => openEdit(p)}><Pencil size={14} /></button>
                          <button aria-label="Delete" onClick={() => onDelete(p)}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {pageItems.length === 0 && (
                    <tr><td colSpan={7} className="adm-empty">No products match these filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="adm-pagination">
              <span>Showing {pageItems.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{(page - 1) * PAGE_SIZE + pageItems.length} of {filtered.length}</span>
              <div className="adm-pagination__btns">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <span>{page} / {pageCount}</span>
                <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {panelOpen && (
        <div className="adm-panel-backdrop" onClick={() => setPanelOpen(false)}>
          <form className="adm-panel-form" onClick={(e) => e.stopPropagation()} onSubmit={onSave}>
            <div className="adm-panel-form__head">
              <h2>{products?.some((p) => p.sku === draft.sku) ? "Edit Product" : "Add Product"}</h2>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Close"><X size={18} /></button>
            </div>

            <div className="adm-panel-form__body">
              {formError && <p className="adm-form-error">{formError}</p>}

              <label className="adm-field">
                <span>Product Title *</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
              </label>

              <div className="adm-field-row">
                <label className="adm-field">
                  <span>Brand *</span>
                  <select value={draft.brand} onChange={(e) => setDraft({ ...draft, brand: e.target.value })}>
                    <option value="">Select brand</option>
                    {brands.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                </label>
                <label className="adm-field">
                  <span>Category *</span>
                  <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                    <option value="">Select category</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="adm-field-row">
                <label className="adm-field">
                  <span>Selling Price (₦) *</span>
                  <input type="number" min="0" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} required />
                </label>
                <label className="adm-field">
                  <span>Compare At Price (₦)</span>
                  <input type="number" min="0" value={draft.was} onChange={(e) => setDraft({ ...draft, was: e.target.value })} placeholder="Optional" />
                </label>
              </div>

              <div className="adm-field-row">
                <label className="adm-field">
                  <span>SKU *</span>
                  <input
                    value={draft.sku}
                    onChange={(e) => setDraft({ ...draft, sku: e.target.value.toUpperCase() })}
                    disabled={products?.some((p) => p.sku === draft.sku)}
                    placeholder="e.g. SF-AC15GEN"
                    required
                  />
                </label>
                <label className="adm-field">
                  <span>Model</span>
                  <input value={draft.model || ""} onChange={(e) => setDraft({ ...draft, model: e.target.value })} />
                </label>
              </div>

              <div className="adm-field-row">
                <label className="adm-field">
                  <span>Stock Quantity *</span>
                  <input type="number" min="0" value={draft.stock} onChange={(e) => setDraft({ ...draft, stock: e.target.value })} required />
                </label>
                <label className="adm-field adm-field--toggle">
                  <span>Status</span>
                  <button
                    type="button"
                    className={"adm-toggle" + (draft.status === "active" ? " adm-toggle--on" : "")}
                    onClick={() => setDraft({ ...draft, status: draft.status === "active" ? "inactive" : "active" })}
                  >
                    <span className="adm-toggle__dot" />
                  </button>
                  <small>{draft.status === "active" ? "Active" : "Inactive"}</small>
                </label>
              </div>

              {draft.category === "air-conditioners" && (
                <div className="adm-field-row">
                  <label className="adm-field">
                    <span>HP</span>
                    <input type="number" step="0.5" min="0" value={draft.hp ?? ""} onChange={(e) => setDraft({ ...draft, hp: e.target.value })} />
                  </label>
                  <label className="adm-field adm-field--toggle">
                    <span>Inverter</span>
                    <button
                      type="button"
                      className={"adm-toggle" + (draft.inverter ? " adm-toggle--on" : "")}
                      onClick={() => setDraft({ ...draft, inverter: !draft.inverter })}
                    >
                      <span className="adm-toggle__dot" />
                    </button>
                    <small>{draft.inverter ? "Yes" : "No"}</small>
                  </label>
                </div>
              )}
              {draft.category === "refrigerators-freezers" && (
                <div className="adm-field-row">
                  <label className="adm-field">
                    <span>Litres</span>
                    <input type="number" min="0" value={draft.litres ?? ""} onChange={(e) => setDraft({ ...draft, litres: e.target.value })} />
                  </label>
                  <label className="adm-field">
                    <span>Doors</span>
                    <input type="number" min="0" value={draft.doors ?? ""} onChange={(e) => setDraft({ ...draft, doors: e.target.value })} />
                  </label>
                </div>
              )}

              <label className="adm-field">
                <span>Image URL</span>
                <input value={draft.image || ""} onChange={(e) => setDraft({ ...draft, image: e.target.value })} placeholder="/products/ac.png" />
              </label>

              <label className="adm-field">
                <span>Short Description <em>{(draft.description || "").length}/160</em></span>
                <textarea
                  rows={3}
                  maxLength={160}
                  value={draft.description || ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </label>

              <ChipField
                label="Product Highlights"
                values={draft.highlights || []}
                onChange={(v) => setDraft({ ...draft, highlights: v })}
              />
              <ChipField
                label="Tags"
                values={draft.tags || []}
                onChange={(v) => setDraft({ ...draft, tags: v })}
              />
            </div>

            <div className="adm-panel-form__foot">
              <button type="button" className="adm-btn" onClick={() => setPanelOpen(false)}>Cancel</button>
              <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
                {saving ? "Saving…" : "Save Product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ChipField({ label, values, onChange }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  }
  return (
    <label className="adm-field">
      <span>{label}</span>
      <div className="adm-chipfield">
        {values.map((v) => (
          <span key={v} className="adm-chip">
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}><X size={11} /></button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Type and press Enter"
        />
      </div>
    </label>
  );
}
