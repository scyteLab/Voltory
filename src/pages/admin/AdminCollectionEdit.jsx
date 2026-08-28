import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Check, ChevronLeft, ChevronRight,
  Image as ImageIcon, RefreshCw, Save, Search, Trash2, X,
} from "lucide-react";
import {
  fetchCollectionById, createCollection, updateCollection,
  fetchCollectionProductSkus, setCollectionProducts,
  searchProductsForPicker, slugify,
} from "../../lib/collectionsClient.js";
import { naira } from "../../utils/format.js";
import { useCatalog } from "../../context/CatalogContext.jsx";

/**
 * AdminCollectionEdit — /admin/collections/new  or  /:id
 *
 * Create or edit a collection. Handles:
 *   · Basic fields (name, slug, description, banner, is_active)
 *   · Slug auto-generation from name (until admin manually edits)
 *   · Product picker: search + paginated table with checkboxes,
 *     "already selected" badge, running count in the header
 *   · Save is atomic-ish: collection first, then product set,
 *     then navigate on success
 */
const PAGE_SIZE = 20;

export default function AdminCollectionEdit() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const { categories, brands } = useCatalog();

  /* Collection fields */
  const [form, setForm] = useState({
    name: "", slug: "", description: "", banner_image: "", is_active: true,
  });
  const [slugTouched, setSlugTouched] = useState(false);

  /* Product picker state */
  const [selectedSkus, setSelectedSkus] = useState([]);   // ordered array
  const [pickerQuery, setPickerQuery]   = useState("");
  const [pickerCategory, setPickerCategory] = useState("");
  const [pickerBrand, setPickerBrand]   = useState("");
  const [pickerPage, setPickerPage]     = useState(0);
  const [pickerResults, setPickerResults] = useState([]);
  const [pickerTotal, setPickerTotal]   = useState(0);
  const [pickerLoading, setPickerLoading] = useState(false);

  /* Page state */
  const [loading, setLoading]     = useState(!isNew);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [flash, setFlash]         = useState(null);

  /* ---- Load existing collection ---- */
  useEffect(() => {
    if (isNew) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [collRes, skusRes] = await Promise.all([
        fetchCollectionById(id),
        fetchCollectionProductSkus(id),
      ]);
      setLoading(false);
      if (!collRes.ok) { setSaveError(collRes.error); return; }
      setForm({
        name:         collRes.data.name || "",
        slug:         collRes.data.slug || "",
        description:  collRes.data.description || "",
        banner_image: collRes.data.banner_image || "",
        is_active:    !!collRes.data.is_active,
      });
      setSlugTouched(true); // existing slug shouldn't auto-regenerate
      if (skusRes.ok) setSelectedSkus(skusRes.data);
    })();
  }, [id, isNew]);

  /* ---- Load product picker results ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPickerLoading(true);
      const res = await searchProductsForPicker({
        q:        pickerQuery,
        category: pickerCategory,
        brand:    pickerBrand,
        limit:    PAGE_SIZE,
        offset:   pickerPage * PAGE_SIZE,
      });
      if (cancelled) return;
      setPickerLoading(false);
      if (res.ok) {
        setPickerResults(res.data);
        setPickerTotal(res.total);
      }
    })();
    return () => { cancelled = true; };
  }, [pickerQuery, pickerCategory, pickerBrand, pickerPage]);

  /* ---- Field handlers ---- */
  function setField(key, val) {
    setForm((f) => {
      const next = { ...f, [key]: val };
      /* Auto-generate slug from name until admin touches slug */
      if (key === "name" && !slugTouched) {
        next.slug = slugify(val);
      }
      return next;
    });
  }

  function toggleProduct(sku) {
    setSelectedSkus((prev) => (
      prev.includes(sku) ? prev.filter((s) => s !== sku) : [...prev, sku]
    ));
  }

  /* ---- Save ---- */
  async function onSave() {
    setSaveError(null);
    setSaving(true);

    const payload = {
      name:         form.name,
      slug:         form.slug,
      description:  form.description,
      banner_image: form.banner_image,
      is_active:    form.is_active,
    };

    const collRes = isNew
      ? await createCollection(payload)
      : await updateCollection(id, payload);

    if (!collRes.ok) {
      setSaving(false);
      setSaveError(collRes.error);
      return;
    }

    const collectionId = collRes.data.id;

    /* Save product membership */
    const prodRes = await setCollectionProducts(collectionId, selectedSkus);
    setSaving(false);
    if (!prodRes.ok) {
      setSaveError(`Collection saved but products failed: ${prodRes.error}`);
      return;
    }

    setFlash("Saved");
    setTimeout(() => setFlash(null), 2000);

    if (isNew) navigate(`/admin/collections/${collectionId}`, { replace: true });
  }

  if (loading) {
    return (
      <div className="adm-page">
        <div className="adm-empty">Loading collection…</div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(pickerTotal / PAGE_SIZE));

  return (
    <div className="adm-page adm-collection-edit">
      <header className="adm-page__head">
        <div>
          <Link to="/admin/collections" className="adm-back">
            <ArrowLeft size={14} /> All Collections
          </Link>
          <h1>{isNew ? "New Collection" : "Edit Collection"}</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {flash && <span className="adm-flash adm-flash--ok"><Check size={13} /> {flash}</span>}
          <button
            className="adm-btn adm-btn--primary"
            onClick={onSave}
            disabled={saving || !form.name.trim() || !form.slug.trim()}
          >
            <Save size={13} /> {saving ? "Saving…" : "Save Collection"}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="adm-flash adm-flash--err" style={{ marginBottom: 16 }}>
          <AlertCircle size={14} /> {saveError}
        </div>
      )}

      <div className="adm-collection-edit__grid">
        {/* ---- Left column: basic info ---- */}
        <section className="adm-card">
          <h2>Details</h2>

          <label className="adm-field">
            <span className="adm-field__label">Name <em>*</em></span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="e.g. Ramadan Essentials"
              disabled={saving}
            />
          </label>

          <label className="adm-field">
            <span className="adm-field__label">Slug <em>*</em></span>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => { setField("slug", e.target.value); setSlugTouched(true); }}
              placeholder="ramadan-essentials"
              disabled={saving}
              className="mono"
            />
            <small className="adm-field__hint">
              URL: <span className="mono">/collection/{form.slug || "…"}</span>
            </small>
          </label>

          <label className="adm-field">
            <span className="adm-field__label">Description</span>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Short summary shown on the collection page and in marketing."
              disabled={saving}
            />
          </label>

          <label className="adm-field">
            <span className="adm-field__label">Banner Image URL</span>
            <input
              type="url"
              value={form.banner_image}
              onChange={(e) => setField("banner_image", e.target.value)}
              placeholder="https://… (paste from your image host)"
              disabled={saving}
            />
            <small className="adm-field__hint">
              Recommended: 1600×500. Any URL works — Cloudinary, S3, direct link.
            </small>
            {form.banner_image && (
              <div className="adm-collection-edit__banner-preview">
                <img src={form.banner_image} alt="" />
              </div>
            )}
          </label>

          <label className="adm-field adm-field--check">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setField("is_active", e.target.checked)}
              disabled={saving}
            />
            <span>Active (visible on storefront)</span>
          </label>
        </section>

        {/* ---- Right column: product picker ---- */}
        <section className="adm-card">
          <h2>
            Products <span className="adm-collection-edit__count">{selectedSkus.length} selected</span>
          </h2>

          <div className="adm-collection-edit__picker-search">
            <Search size={14} />
            <input
              type="text"
              value={pickerQuery}
              onChange={(e) => { setPickerQuery(e.target.value); setPickerPage(0); }}
              placeholder="Search products by name or SKU…"
              disabled={saving}
            />
          </div>

          <div className="adm-collection-edit__picker-filters">
            <select
              value={pickerCategory}
              onChange={(e) => { setPickerCategory(e.target.value); setPickerPage(0); }}
              disabled={saving}
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <select
              value={pickerBrand}
              onChange={(e) => { setPickerBrand(e.target.value); setPickerPage(0); }}
              disabled={saving}
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
            {(pickerCategory || pickerBrand) && (
              <button
                type="button"
                className="adm-collection-edit__picker-clear"
                onClick={() => { setPickerCategory(""); setPickerBrand(""); setPickerPage(0); }}
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>

          {pickerLoading && (
            <div className="adm-empty" style={{ padding: 20 }}>Loading products…</div>
          )}

          {!pickerLoading && pickerResults.length === 0 && (
            <div className="adm-empty" style={{ padding: 20 }}>
              <p>No products match your search.</p>
            </div>
          )}

          {!pickerLoading && pickerResults.length > 0 && (
            <>
              <div className="adm-collection-edit__picker-scroll">
                <table className="adm-collection-edit__picker-tbl">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Product</th>
                      <th>SKU</th>
                      <th className="right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickerResults.map((p) => {
                      const selected = selectedSkus.includes(p.sku);
                      return (
                        <tr
                          key={p.sku}
                          className={selected ? "adm-collection-edit__row--selected" : ""}
                          onClick={() => toggleProduct(p.sku)}
                        >
                          <td>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleProduct(p.sku)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td>
                            <div className="adm-collection-edit__prod">
                              {p.image
                                ? <img src={p.image} alt="" />
                                : <span className="adm-collection-edit__prod-noimg"><ImageIcon size={14} /></span>
                              }
                              <div>
                                <b>{p.name}</b>
                                <small>{p.brand} · {p.category}</small>
                              </div>
                            </div>
                          </td>
                          <td className="mono">{p.sku}</td>
                          <td className="right">{naira(p.price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="adm-collection-edit__picker-pager">
                <span>
                  Page {pickerPage + 1} of {totalPages} — {pickerTotal.toLocaleString()} products
                </span>
                <div>
                  <button
                    className="adm-btn adm-btn--secondary adm-btn--sm"
                    onClick={() => setPickerPage((p) => Math.max(0, p - 1))}
                    disabled={pickerPage === 0}
                  >
                    <ChevronLeft size={13} /> Prev
                  </button>
                  <button
                    className="adm-btn adm-btn--secondary adm-btn--sm"
                    onClick={() => setPickerPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={pickerPage >= totalPages - 1}
                  >
                    Next <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </>
          )}

          {selectedSkus.length > 0 && (
            <div className="adm-collection-edit__picker-hint">
              <b>{selectedSkus.length}</b> product{selectedSkus.length === 1 ? "" : "s"} will be saved
              to this collection when you click <b>Save</b>. Products appear on the collection page
              in the order you selected them.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}