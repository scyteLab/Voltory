import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, Check, Eye, EyeOff, Filter,
  GripVertical, Info, Plus, Save, Sliders, Trash2, X,
} from "lucide-react";
import {
  fetchAttributeById, createAttribute, updateAttribute,
  setAttributeValues, setAttributeCategories, fetchCategoriesList,
  ATTRIBUTE_TYPES, typeHasValues, typeHasUnit, slugify,
} from "../../lib/attributesClient.js";

/**
 * AdminAttributeEdit — /admin/attributes/new  or  /:id
 *
 * Create or edit an attribute definition. Handles:
 *   · Basic fields: name, slug, type, unit, description, flags
 *   · Values editor: only shown for select/multi_select/color types
 *   · Category mapping: which categories this attribute applies to
 *   · Auto-slug from name (until admin edits slug manually)
 *   · Type change warnings when moving away from a value-based type
 *
 * Save is 3-step (attribute upsert → values → categories).
 * On any step failure, we surface the error but leave earlier
 * steps committed. Acceptable at MVP for admin operations.
 */
export default function AdminAttributeEdit() {
  const { id } = useParams();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  /* Basic fields */
  const [form, setForm] = useState({
    name: "", slug: "", type: "select", unit: "",
    description: "", is_filterable: true, is_visible: true, position: 0,
  });
  const [slugTouched, setSlugTouched] = useState(false);

  /* Values editor state */
  const [values, setValues] = useState([]);

  /* Category mapping */
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);

  /* Page state */
  const [loading, setLoading]     = useState(!isNew);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [flash, setFlash]         = useState(null);

  /* ---- Load categories list + existing attribute ---- */
  useEffect(() => {
    (async () => {
      const catsRes = await fetchCategoriesList();
      if (catsRes.ok) setAllCategories(catsRes.data);
    })();
  }, []);

  useEffect(() => {
    if (isNew) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const res = await fetchAttributeById(id);
      setLoading(false);
      if (!res.ok) { setSaveError(res.error); return; }
      const a = res.data.attribute;
      setForm({
        name:          a.name || "",
        slug:          a.slug || "",
        type:          a.type || "select",
        unit:          a.unit || "",
        description:   a.description || "",
        is_filterable: !!a.is_filterable,
        is_visible:    !!a.is_visible,
        position:      a.position || 0,
      });
      setSlugTouched(true);
      setValues(res.data.values || []);
      setSelectedCategoryIds(res.data.categoryIds || []);
    })();
  }, [id, isNew]);

  /* ---- Field handlers ---- */

  function setField(key, val) {
    setForm((f) => {
      const next = { ...f, [key]: val };
      if (key === "name" && !slugTouched) next.slug = slugify(val);
      /* Clear unit when switching to a type that doesn't use it */
      if (key === "type" && !typeHasUnit(val)) next.unit = "";
      return next;
    });
  }

  function addValue() {
    setValues((v) => [...v, { value: "", label: "", hex_color: "" }]);
  }
  function updateValue(idx, key, val) {
    setValues((v) => v.map((row, i) => (i === idx ? { ...row, [key]: val } : row)));
  }
  function removeValue(idx) {
    setValues((v) => v.filter((_, i) => i !== idx));
  }
  function moveValue(idx, direction) {
    setValues((v) => {
      const next = [...v];
      const target = idx + direction;
      if (target < 0 || target >= next.length) return v;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function toggleCategory(catId) {
    setSelectedCategoryIds((ids) => (
      ids.includes(catId) ? ids.filter((x) => x !== catId) : [...ids, catId]
    ));
  }

  /* ---- Save ---- */

  async function onSave() {
    setSaveError(null);
    setSaving(true);

    /* Step 1: attribute row */
    const payload = {
      name:          form.name,
      slug:          form.slug,
      type:          form.type,
      unit:          form.unit,
      description:   form.description,
      is_filterable: form.is_filterable,
      is_visible:    form.is_visible,
      position:      form.position,
    };

    const attrRes = isNew
      ? await createAttribute(payload)
      : await updateAttribute(id, payload);

    if (!attrRes.ok) {
      setSaving(false);
      setSaveError(attrRes.error);
      return;
    }

    const attributeId = attrRes.data.id;

    /* Step 2: values (only for value-based types) */
    if (typeHasValues(form.type)) {
      const valsRes = await setAttributeValues(attributeId, values);
      if (!valsRes.ok) {
        setSaving(false);
        setSaveError(`Attribute saved but values failed: ${valsRes.error}`);
        return;
      }
    } else {
      /* Type doesn't use values — clear any that might exist from a
         previous save when type was different */
      await setAttributeValues(attributeId, []);
    }

    /* Step 3: categories */
    const catsRes = await setAttributeCategories(attributeId, selectedCategoryIds);
    setSaving(false);
    if (!catsRes.ok) {
      setSaveError(`Attribute saved but categories failed: ${catsRes.error}`);
      return;
    }

    setFlash("Saved");
    setTimeout(() => setFlash(null), 2000);
    if (isNew) navigate(`/admin/attributes/${attributeId}`, { replace: true });
  }

  if (loading) {
    return (
      <div className="adm-page">
        <div className="adm-empty">Loading attribute…</div>
      </div>
    );
  }

  const showValuesEditor = typeHasValues(form.type);
  const showUnitField    = typeHasUnit(form.type);
  const currentType      = ATTRIBUTE_TYPES.find((t) => t.value === form.type);

  return (
    <div className="adm-page adm-attribute-edit">
      <header className="adm-page__head">
        <div>
          <Link to="/admin/attributes" className="adm-back">
            <ArrowLeft size={14} /> All Attributes
          </Link>
          <h1>
            <Sliders size={22} style={{ verticalAlign: "middle", marginRight: 8 }} />
            {isNew ? "New Attribute" : "Edit Attribute"}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {flash && <span className="adm-flash adm-flash--ok"><Check size={13} /> {flash}</span>}
          <button
            className="adm-btn adm-btn--primary"
            onClick={onSave}
            disabled={saving || !form.name.trim() || !form.slug.trim()}
          >
            <Save size={13} /> {saving ? "Saving…" : "Save Attribute"}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="adm-flash adm-flash--err" style={{ marginBottom: 16 }}>
          <AlertCircle size={14} /> {saveError}
        </div>
      )}

      <div className="adm-attribute-edit__grid">
        {/* ==============================================
             LEFT COLUMN
             — basic info + values editor
             ============================================== */}
        <div className="adm-attribute-edit__col">
          {/* Basic fields */}
          <section className="adm-card">
            <h2>Details</h2>

            <label className="adm-field">
              <span className="adm-field__label">Name <em>*</em></span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Color, Screen Size, Capacity"
                disabled={saving}
              />
            </label>

            <label className="adm-field">
              <span className="adm-field__label">Slug <em>*</em></span>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => { setField("slug", e.target.value); setSlugTouched(true); }}
                placeholder="color"
                disabled={saving}
                className="mono"
              />
              <small className="adm-field__hint">
                URL-safe identifier. Used in filter URLs like <span className="mono">?color=silver</span>.
              </small>
            </label>

            <label className="adm-field">
              <span className="adm-field__label">Type <em>*</em></span>
              <select
                value={form.type}
                onChange={(e) => setField("type", e.target.value)}
                disabled={saving}
              >
                {ATTRIBUTE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {currentType && (
                <small className="adm-field__hint">
                  <Info size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  {currentType.hint}
                </small>
              )}
            </label>

            {showUnitField && (
              <label className="adm-field">
                <span className="adm-field__label">Unit</span>
                <input
                  type="text"
                  value={form.unit}
                  onChange={(e) => setField("unit", e.target.value)}
                  placeholder="L, kg, HP, BTU, W…"
                  disabled={saving}
                />
                <small className="adm-field__hint">
                  Shown after the number on the product page (e.g. "350 L").
                </small>
              </label>
            )}

            <label className="adm-field">
              <span className="adm-field__label">Description</span>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Optional. Admin-only note explaining what this attribute is for."
                disabled={saving}
              />
            </label>

            <div className="adm-attribute-edit__flags">
              <label className="adm-field adm-field--check">
                <input
                  type="checkbox"
                  checked={form.is_filterable}
                  onChange={(e) => setField("is_filterable", e.target.checked)}
                  disabled={saving}
                />
                <span><Filter size={12} /> Show as filter on category pages</span>
              </label>
              <label className="adm-field adm-field--check">
                <input
                  type="checkbox"
                  checked={form.is_visible}
                  onChange={(e) => setField("is_visible", e.target.checked)}
                  disabled={saving}
                />
                <span><Eye size={12} /> Show on product page specs table</span>
              </label>
            </div>
          </section>

          {/* Values editor — only for select-type attributes */}
          {showValuesEditor && (
            <section className="adm-card">
              <h2>
                Allowed Values
                <span className="adm-attribute-edit__count">
                  {values.length} value{values.length === 1 ? "" : "s"}
                </span>
              </h2>
              <p className="adm-attribute-edit__hint">
                Add one row per allowed option. Value is the machine identifier
                (used in URLs), label is what customers see.
                {form.type === "color" && (
                  <> Hex color renders as a swatch in filter UI.</>
                )}
              </p>

              {values.length === 0 && (
                <div className="adm-attribute-edit__no-values">
                  <p>No values yet. Add your first one below.</p>
                </div>
              )}

              {values.length > 0 && (
                <ul className="adm-attribute-edit__values">
                  {values.map((v, idx) => (
                    <li key={idx} className="adm-attribute-edit__value-row">
                      <div className="adm-attribute-edit__value-move">
                        <button
                          type="button"
                          onClick={() => moveValue(idx, -1)}
                          disabled={idx === 0 || saving}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveValue(idx, 1)}
                          disabled={idx === values.length - 1 || saving}
                          title="Move down"
                        >
                          ↓
                        </button>
                      </div>

                      <input
                        type="text"
                        value={v.value}
                        onChange={(e) => updateValue(idx, "value", e.target.value)}
                        placeholder="silver"
                        className="mono"
                        disabled={saving}
                      />
                      <input
                        type="text"
                        value={v.label}
                        onChange={(e) => updateValue(idx, "label", e.target.value)}
                        placeholder="Silver"
                        disabled={saving}
                      />

                      {form.type === "color" && (
                        <div className="adm-attribute-edit__color-picker">
                          <input
                            type="color"
                            value={v.hex_color || "#cccccc"}
                            onChange={(e) => updateValue(idx, "hex_color", e.target.value)}
                            disabled={saving}
                          />
                          <input
                            type="text"
                            value={v.hex_color || ""}
                            onChange={(e) => updateValue(idx, "hex_color", e.target.value)}
                            placeholder="#C0C0C0"
                            className="mono"
                            disabled={saving}
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        className="adm-attribute-edit__value-del"
                        onClick={() => removeValue(idx)}
                        disabled={saving}
                        title="Remove value"
                      >
                        <X size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                type="button"
                className="adm-btn adm-btn--secondary adm-btn--sm"
                onClick={addValue}
                disabled={saving}
                style={{ marginTop: 12 }}
              >
                <Plus size={12} /> Add value
              </button>
            </section>
          )}
        </div>

        {/* ==============================================
             RIGHT COLUMN
             — category mapping
             ============================================== */}
        <div className="adm-attribute-edit__col">
          <section className="adm-card">
            <h2>
              Applies To
              <span className="adm-attribute-edit__count">
                {selectedCategoryIds.length === 0
                  ? "All categories"
                  : `${selectedCategoryIds.length} categor${selectedCategoryIds.length === 1 ? "y" : "ies"}`
                }
              </span>
            </h2>
            <p className="adm-attribute-edit__hint">
              Pick which categories this attribute is relevant to.
              For example: <em>Screen Size</em> applies to TVs but not fridges.
              Leaving none selected means it applies globally.
            </p>

            {allCategories.length === 0 ? (
              <div className="adm-attribute-edit__no-values">
                <p>No categories yet. Create categories first before mapping attributes.</p>
              </div>
            ) : (
              <ul className="adm-attribute-edit__cats">
                {allCategories.map((c) => {
                  const checked = selectedCategoryIds.includes(c.id);
                  return (
                    <li key={c.id}>
                      <label className={"adm-attribute-edit__cat" + (checked ? " on" : "")}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCategory(c.id)}
                          disabled={saving}
                        />
                        <span>{c.label}</span>
                        <small className="mono">{c.id}</small>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}