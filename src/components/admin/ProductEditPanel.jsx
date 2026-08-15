import { useEffect, useState } from "react";
import {
  AlertTriangle, Check, Image as ImageIcon, Plus, Save,
  Trash2, X,
} from "lucide-react";
import ImageUploader from "./ImageUploader.jsx";
import {
  specSuggestionsFor, ENERGY_CLASSES,
} from "../../config/categorySpecSuggestions.js";

/**
 * Product edit panel \u2014 right column of the catalog page.
 *
 * Modes:
 *   \u00B7 "new"    \u2014 empty form for a brand-new product
 *   \u00B7 "edit"   \u2014 pre-filled with the selected product's data
 *   \u00B7 "closed" \u2014 empty state, prompts user to select or add
 *
 * Session-1a additions:
 *   \u00B7 New Specifications section: Warranty (months), Energy
 *     Class (dropdown), and a dynamic Specs repeater
 *     ({label, value}[] shape, matching the existing DB
 *     convention where specs is a JSONB array).
 *   \u00B7 Category-aware label suggestions via categorySpec-
 *     Suggestions \u2014 admin sees hints appropriate to whatever
 *     category is currently picked in the Brand/Category row.
 *
 * NOT changed:
 *   \u00B7 The appliance-specific columns (hp, litres, doors,
 *     inverter) are still in the DB but not surfaced in this
 *     form. Preserved verbatim on save. Future session adds a
 *     category-conditional UI for them.
 *   \u00B7 Highlights repeater, image uploader, delete flow, all
 *     other fields \u2014 unchanged.
 */

function emptyProduct() {
  return {
    sku: "", slug: "", name: "", brand: "", category: "",
    model: "", image: "", gallery: [], price: "", was: "", stock: "",
    status: "active", rating: null, reviews: 0, questions: 0,
    hp: null, inverter: null, litres: null, doors: null,
    tags: [], highlights: [], specs: [], description: "",
    // Session-1a additions
    warranty_months: null,
    energy_class:    null,
  };
}

function toEditable(p) {
  if (!p) return emptyProduct();
  return {
    ...emptyProduct(),
    ...p,
    highlights: Array.isArray(p.highlights) ? p.highlights : [],
    tags:       Array.isArray(p.tags)       ? p.tags       : [],
    specs:      Array.isArray(p.specs)      ? p.specs      : [],
    gallery:    Array.isArray(p.gallery)    ? p.gallery    : [],
  };
}

function autoSlug(name) {
  return (name || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export default function ProductEditPanel({
  mode, product, brands, categories,
  onSave, onCancel, onDelete, saving,
}) {
  const [form, setForm] = useState(() => toEditable(product));
  const [errors, setErrors] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setForm(toEditable(product));
    setErrors({});
    setSaveError(null);
    setConfirmDelete(false);
  }, [product?.sku, mode]);

  if (mode === "closed") {
    return (
      <aside className="adm-editpanel adm-editpanel--empty">
        <span className="adm-editpanel__blob">
          <ImageIcon size={32} strokeWidth={1.4} />
        </span>
        <b>Select a product to edit</b>
        <p>Click a row on the left, or hit <em>Add Product</em> to start a new one.</p>
      </aside>
    );
  }

  function field(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (mode === "new" && k === "name" && !f.slug) {
        next.slug = autoSlug(v);
      }
      return next;
    });
    setErrors((er) => ({ ...er, [k]: undefined }));
  }

  /* ---- Highlights repeater (existing, unchanged) ---- */

  function addHighlight() {
    setForm((f) => ({ ...f, highlights: [...(f.highlights || []), ""] }));
  }
  function setHighlight(i, val) {
    setForm((f) => ({
      ...f,
      highlights: (f.highlights || []).map((h, idx) => (idx === i ? val : h)),
    }));
  }
  function removeHighlight(i) {
    setForm((f) => ({
      ...f,
      highlights: (f.highlights || []).filter((_, idx) => idx !== i),
    }));
  }

  /* ---- Specs repeater (new this session) ---- */

  function addSpec() {
    setForm((f) => ({
      ...f,
      specs: [...(f.specs || []), { label: "", value: "" }],
    }));
  }
  function setSpec(i, key, val) {
    setForm((f) => ({
      ...f,
      specs: (f.specs || []).map((s, idx) =>
        idx === i ? { ...s, [key]: val } : s
      ),
    }));
  }
  function removeSpec(i) {
    setForm((f) => ({
      ...f,
      specs: (f.specs || []).filter((_, idx) => idx !== i),
    }));
  }

  /* ---- Validation ---- */

  function validate() {
    const errs = {};
    if (!form.name?.trim())      errs.name = "Product name is required";
    if (!form.sku?.trim())       errs.sku = "SKU is required";
    if (!form.slug?.trim())      errs.slug = "Slug is required";
    if (!form.brand)             errs.brand = "Choose a brand";
    if (!form.category)          errs.category = "Choose a category";
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) errs.price = "Price must be a positive number";
    const stock = Number(form.stock);
    if (!Number.isFinite(stock) || stock < 0)  errs.stock = "Stock must be zero or higher";
    if (form.was && Number(form.was) <= price) errs.was = "Compare-at price must be higher than the selling price";

    // Session-1a: warranty is optional but if provided must be a
    // positive integer number of months (0 = "no warranty" is
    // also valid, but nulling it is cleaner \u2014 discourage 0)
    if (form.warranty_months !== "" && form.warranty_months != null) {
      const w = Number(form.warranty_months);
      if (!Number.isInteger(w) || w < 0) {
        errs.warranty_months = "Warranty must be a whole number of months";
      }
    }
    return errs;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaveError(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    /* Strip empty specs (both label and value blank). Trim
       label/value so accidental whitespace doesn't render as
       phantom rows on the product page. */
    const cleanedSpecs = (form.specs || [])
      .map((s) => ({
        label: (s.label || "").trim(),
        value: (s.value || "").trim(),
      }))
      .filter((s) => s.label || s.value);

    const payload = {
      ...form,
      price: Number(form.price),
      was:   form.was === "" || form.was == null ? null : Number(form.was),
      stock: Number(form.stock),
      hp:      form.hp === "" || form.hp == null ? null : Number(form.hp),
      litres:  form.litres === "" || form.litres == null ? null : Number(form.litres),
      doors:   form.doors === "" || form.doors == null ? null : Number(form.doors),
      inverter: form.inverter === "" || form.inverter == null
        ? null
        : form.inverter === true || form.inverter === "true",
      highlights: (form.highlights || []).filter((h) => h && h.trim()),
      gallery:    (form.gallery || []).filter((u) => u && u.trim()),
      specs:      cleanedSpecs,
      warranty_months: form.warranty_months === "" || form.warranty_months == null
        ? null
        : Number(form.warranty_months),
      energy_class:    form.energy_class || null,
    };

    try {
      await onSave(payload);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      setSaveError(err.message || String(err));
    }
  }

  async function confirmAndDelete() {
    try {
      await onDelete(form.sku);
    } catch (err) {
      setSaveError(err.message || String(err));
    }
  }

  /* Suggestions for the specs label datalist, based on the
     currently-selected category. Datalist gives autocomplete
     without forcing a value \u2014 admin can pick a suggestion or
     type their own. */
  const specLabelSuggestions = specSuggestionsFor(form.category);

  return (
    <aside className="adm-editpanel">
      <header className="adm-editpanel__head">
        <div>
          <b>{mode === "new" ? "Add New Product" : "Edit Product"}</b>
          <small>{mode === "new" ? "Fill the details, then save." : `SKU: ${form.sku}`}</small>
        </div>
        <button className="adm-icon-btn adm-icon-btn--sm" onClick={onCancel} aria-label="Close panel">
          <X size={16} />
        </button>
      </header>

      <form onSubmit={onSubmit} className="adm-editpanel__body">
        <ImageUploader
          mainImage={form.image}
          gallery={Array.isArray(form.gallery) ? form.gallery : []}
          onMainChange={(url) => field("image", url)}
          onGalleryChange={(urls) => field("gallery", urls)}
          skuHint={form.sku || "unassigned"}
        />

        <FormRow>
          <Field label="Image URL (or paste one)">
            <input
              type="text" value={form.image || ""}
              onChange={(e) => field("image", e.target.value)}
              placeholder="Auto-fills when you upload above, or paste a URL"
            />
          </Field>
        </FormRow>

        <FormRow>
          <Field label="Product Title" error={errors.name} required>
            <input
              type="text" value={form.name || ""}
              onChange={(e) => field("name", e.target.value)}
              placeholder="e.g. Midea 1.5HP Inverter Split AC"
            />
          </Field>
        </FormRow>

        <FormRow cols={2}>
          <Field label="Brand" error={errors.brand} required>
            <select value={form.brand || ""} onChange={(e) => field("brand", e.target.value)}>
              <option value="">Choose brand\u2026</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          <Field label="Category" error={errors.category} required>
            <select value={form.category || ""} onChange={(e) => field("category", e.target.value)}>
              <option value="">Choose category\u2026</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        </FormRow>

        <FormRow cols={2}>
          <Field label="Selling Price (\u20A6)" error={errors.price} required>
            <input
              type="number" inputMode="numeric" min="0"
              value={form.price ?? ""}
              onChange={(e) => field("price", e.target.value)}
              placeholder="520000"
            />
          </Field>
          <Field label="Compare-at Price (\u20A6)" error={errors.was}>
            <input
              type="number" inputMode="numeric" min="0"
              value={form.was ?? ""}
              onChange={(e) => field("was", e.target.value)}
              placeholder="580000 (optional)"
            />
          </Field>
        </FormRow>

        <FormRow cols={2}>
          <Field label="SKU" error={errors.sku} required>
            <input
              type="text" value={form.sku || ""}
              onChange={(e) => field("sku", e.target.value.toUpperCase())}
              placeholder="VAC-0015INV"
              disabled={mode === "edit"}
            />
          </Field>
          <Field label="Model">
            <input
              type="text" value={form.model || ""}
              onChange={(e) => field("model", e.target.value)}
              placeholder="e.g. MSAFB-12HRDN8"
            />
          </Field>
        </FormRow>

        <FormRow cols={2}>
          <Field label="Slug" error={errors.slug} required>
            <input
              type="text" value={form.slug || ""}
              onChange={(e) => field("slug", e.target.value)}
              placeholder="midea-1-5hp-inverter-split-ac"
            />
          </Field>
          <Field label="Stock Quantity" error={errors.stock} required>
            <input
              type="number" inputMode="numeric" min="0"
              value={form.stock ?? ""}
              onChange={(e) => field("stock", e.target.value)}
              placeholder="45"
            />
          </Field>
        </FormRow>

        <FormRow>
          <Field label="Status">
            <select value={form.status || "active"} onChange={(e) => field("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        </FormRow>

        <FormRow>
          <Field label="Short Description">
            <textarea
              rows={3}
              value={form.description || ""}
              onChange={(e) => field("description", e.target.value)}
              placeholder="One-paragraph summary that shows on the product page."
              maxLength={280}
            />
            <small className="adm-field__counter">{(form.description || "").length}/280</small>
          </Field>
        </FormRow>

        <FormRow>
          <Field label="Product Highlights">
            <ul className="adm-highlights">
              {(form.highlights || []).map((h, i) => (
                <li key={i}>
                  <input
                    type="text" value={h}
                    onChange={(e) => setHighlight(i, e.target.value)}
                    placeholder="Highlight line (e.g. Inverter Compressor)"
                  />
                  <button type="button" onClick={() => removeHighlight(i)} aria-label="Remove highlight">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button" className="adm-btn adm-btn--secondary adm-btn--sm"
              onClick={addHighlight}
            >
              <Plus size={13} /> Add highlight
            </button>
          </Field>
        </FormRow>

        {/* ============================================
             SPECIFICATIONS  (session 1a)
             ============================================ */}
        <div className="adm-specs-section">
          <h3 className="adm-specs-section__title">Specifications</h3>
          <p className="adm-specs-section__hint">
            Structured specs shown on the product page. Warranty and energy class are
            highlighted; additional specs appear as a labeled table.
          </p>

          <FormRow cols={2}>
            <Field label="Warranty (months)" error={errors.warranty_months}>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={form.warranty_months ?? ""}
                onChange={(e) => field("warranty_months", e.target.value)}
                placeholder="e.g. 24"
              />
            </Field>
            <Field label="Energy Class">
              <select
                value={form.energy_class || ""}
                onChange={(e) => field("energy_class", e.target.value)}
              >
                {ENERGY_CLASSES.map((cls) => (
                  <option key={cls || "none"} value={cls}>
                    {cls || "Not rated"}
                  </option>
                ))}
              </select>
            </Field>
          </FormRow>

          <FormRow>
            <Field label="Additional specs">
              {/* datalist provides label autocomplete suggestions
                  based on the selected category */}
              <datalist id={`spec-labels-${form.category || "default"}`}>
                {specLabelSuggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>

              <ul className="adm-specs-list">
                {(form.specs || []).map((s, i) => (
                  <li key={i} className="adm-specs-list__row">
                    <input
                      type="text"
                      value={s.label || ""}
                      onChange={(e) => setSpec(i, "label", e.target.value)}
                      placeholder="Label (e.g. Capacity)"
                      list={`spec-labels-${form.category || "default"}`}
                    />
                    <input
                      type="text"
                      value={s.value || ""}
                      onChange={(e) => setSpec(i, "value", e.target.value)}
                      placeholder="Value (e.g. 350L)"
                    />
                    <button
                      type="button"
                      onClick={() => removeSpec(i)}
                      aria-label="Remove spec"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="adm-btn adm-btn--secondary adm-btn--sm"
                onClick={addSpec}
              >
                <Plus size={13} /> Add spec
              </button>
            </Field>
          </FormRow>
        </div>

        {saveError && (
          <div className="adm-empty adm-empty--err" style={{ padding: "14px 16px" }}>
            <AlertTriangle size={18} /> <b>Save failed</b> <span>{saveError}</span>
          </div>
        )}

        <footer className="adm-editpanel__foot">
          <div className="adm-editpanel__foot-left">
            {mode === "edit" && (
              confirmDelete
                ? (
                  <>
                    <button type="button" className="adm-btn adm-btn--danger" onClick={confirmAndDelete}>
                      Yes, delete permanently
                    </button>
                    <button type="button" className="adm-btn adm-btn--secondary" onClick={() => setConfirmDelete(false)}>
                      No, keep
                    </button>
                  </>
                )
                : (
                  <button type="button" className="adm-btn adm-btn--ghost-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={13} /> Delete
                  </button>
                )
            )}
          </div>
          <div className="adm-editpanel__foot-right">
            <button type="button" className="adm-btn adm-btn--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={saving}>
              {savedFlash ? <><Check size={13} /> Saved</> : <><Save size={13} /> {saving ? "Saving\u2026" : "Save Product"}</>}
            </button>
          </div>
        </footer>
      </form>
    </aside>
  );
}

function FormRow({ children, cols = 1 }) {
  return (
    <div className="adm-formrow" data-cols={cols}>{children}</div>
  );
}

function Field({ label, children, error, required }) {
  return (
    <label className={"adm-field" + (error ? " adm-field--err" : "")}>
      <span className="adm-field__label">
        {label} {required && <em>*</em>}
      </span>
      {children}
      {error && <small className="adm-field__err">{error}</small>}
    </label>
  );
}