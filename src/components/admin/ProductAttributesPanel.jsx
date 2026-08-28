import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Check, Info, RefreshCw, Save, Sliders,
} from "lucide-react";
import {
  fetchAttributesForCategory, fetchProductAttributes, saveProductAttributes,
} from "../../lib/productAttributesClient.js";

/**
 * ProductAttributesPanel  —  admin-side per-product attribute editor
 *
 * Slotted inside ProductEditPanel after the Specifications section.
 * Has its OWN Save button separate from "Save Product" — admin can
 * save basic product info and attributes independently.
 *
 * Load sequence on mount / category change:
 *   1. Fetch all attributes that apply to this product's category
 *      (mapped + globally-scoped attributes with no mapping)
 *   2. If we have a SKU (edit mode), fetch the product's current
 *      attribute assignments and merge into local state
 *   3. Render one input row per attribute, matching its type
 *
 * Rendering per type:
 *   text          → <input type="text">
 *   number        → <input type="number"> + unit label
 *   boolean       → tri-state dropdown (Unset / Yes / No)
 *   select        → <select> single choice
 *   color         → <select> with swatch preview
 *   multi_select  → checkbox grid
 *
 * Guard rails:
 *   · Disabled entirely for new-product mode (no SKU yet)
 *   · "No attributes apply" empty state when category has none
 *   · Error state with retry
 *   · Local edit tracking — shows "unsaved changes" hint
 */
export default function ProductAttributesPanel({ productSku, categoryId, mode }) {
  const [attributes, setAttributes] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [dirty, setDirty] = useState(false);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);

  /* ---- Load attributes for this category + current assignments ---- */

  async function load() {
    if (!categoryId) {
      setAttributes([]);
      setAssignments({});
      return;
    }
    setLoading(true);
    setError(null);

    /* Attributes for this category */
    const attrRes = await fetchAttributesForCategory(categoryId);
    if (!attrRes.ok) {
      setLoading(false);
      setError(attrRes.error);
      return;
    }
    setAttributes(attrRes.data);

    /* Existing assignments (only if we have a SKU — edit mode) */
    if (productSku) {
      const pavRes = await fetchProductAttributes(productSku);
      if (!pavRes.ok) {
        setLoading(false);
        setError(pavRes.error);
        return;
      }
      setAssignments(buildAssignmentMap(pavRes.data));
    } else {
      setAssignments({});
    }

    setDirty(false);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSku, categoryId]);

  /* ---- Field handlers ---- */

  function setValue(attributeId, patch) {
    setAssignments((prev) => ({
      ...prev,
      [attributeId]: { ...(prev[attributeId] || {}), ...patch },
    }));
    setDirty(true);
    setSaveError(null);
  }

  function toggleMulti(attributeId, valueId) {
    setAssignments((prev) => {
      const current = prev[attributeId] || {};
      const ids = new Set(current.attribute_value_ids || []);
      if (ids.has(valueId)) ids.delete(valueId);
      else ids.add(valueId);
      return {
        ...prev,
        [attributeId]: { ...current, attribute_value_ids: Array.from(ids) },
      };
    });
    setDirty(true);
    setSaveError(null);
  }

  /* ---- Save ---- */

  async function onSave() {
    if (!productSku) {
      setSaveError("Save the product first before assigning attributes.");
      return;
    }

    setSaving(true);
    setSaveError(null);

    /* Build the assignments payload from local state */
    const payload = attributes.map((attr) => {
      const val = assignments[attr.id] || {};
      return {
        attribute_id: attr.id,
        type:         attr.type,
        value_text:          val.value_text,
        value_number:        val.value_number,
        value_boolean:       val.value_boolean,
        attribute_value_id:  val.attribute_value_id,
        attribute_value_ids: val.attribute_value_ids,
      };
    });

    const res = await saveProductAttributes(productSku, payload);
    setSaving(false);

    if (!res.ok) {
      setSaveError(res.error);
      return;
    }

    setDirty(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  /* ---- Render states ---- */

  const isNewMode = mode === "new" || !productSku;

  return (
    <div className="adm-pav">
      <div className="adm-pav__head">
        <h3>
          <Sliders size={16} /> Attributes
          {dirty && !savedFlash && (
            <span className="adm-pav__dirty">• unsaved</span>
          )}
        </h3>
        <div className="adm-pav__head-actions">
          <button
            type="button"
            className="adm-btn adm-btn--secondary adm-btn--sm"
            onClick={load}
            disabled={loading || saving}
            title="Reload attribute values"
          >
            <RefreshCw size={12} />
          </button>
          <button
            type="button"
            className="adm-btn adm-btn--primary adm-btn--sm"
            onClick={onSave}
            disabled={saving || loading || isNewMode || attributes.length === 0}
          >
            {savedFlash ? (
              <><Check size={12} /> Saved</>
            ) : (
              <><Save size={12} /> {saving ? "Saving…" : "Save Attributes"}</>
            )}
          </button>
        </div>
      </div>

      <p className="adm-pav__hint">
        Structured properties defined in Catalog → Attributes. Only attributes
        that apply to this product's category are shown. Session 3 will make
        filterable ones appear on category page filters.
      </p>

      {/* New-mode guard */}
      {isNewMode && (
        <div className="adm-pav__notice">
          <Info size={14} />
          <p>
            Save the product first (top of the panel) to unlock attribute
            editing. Attributes save separately from basic product info.
          </p>
        </div>
      )}

      {/* No category picked */}
      {!isNewMode && !categoryId && (
        <div className="adm-pav__notice">
          <Info size={14} />
          <p>Pick a category above to see relevant attributes.</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="adm-pav__empty">Loading attributes…</div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="adm-pav__empty adm-pav__empty--err">
          <AlertCircle size={14} />
          <b>Couldn't load attributes.</b>
          <p>{error}</p>
          <button className="adm-btn adm-btn--secondary adm-btn--sm" onClick={load}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Empty — no attributes apply */}
      {!loading && !error && !isNewMode && categoryId && attributes.length === 0 && (
        <div className="adm-pav__empty">
          <p>
            No attributes are set up for this category yet. Go to
            <b> Catalog → Attributes</b> to create some, then map them
            to this category.
          </p>
        </div>
      )}

      {/* Fields */}
      {!loading && !error && attributes.length > 0 && (
        <>
          {saveError && (
            <div className="adm-pav__saveerr">
              <AlertCircle size={13} /> {saveError}
            </div>
          )}

          <div className="adm-pav__fields">
            {attributes.map((attr) => (
              <AttributeInput
                key={attr.id}
                attribute={attr}
                value={assignments[attr.id] || {}}
                onChange={(patch) => setValue(attr.id, patch)}
                onToggleMulti={(vid) => toggleMulti(attr.id, vid)}
                disabled={saving || isNewMode}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Per-attribute input row
   ============================================================ */

function AttributeInput({ attribute, value, onChange, onToggleMulti, disabled }) {
  const { type, unit, allowed_values = [] } = attribute;

  const inputEl = (() => {
    switch (type) {
      case "text":
        return (
          <input
            type="text"
            value={value.value_text || ""}
            onChange={(e) => onChange({ value_text: e.target.value })}
            disabled={disabled}
            placeholder="Enter value…"
          />
        );

      case "number":
        return (
          <div className="adm-pav__number">
            <input
              type="number"
              inputMode="numeric"
              step="any"
              value={value.value_number ?? ""}
              onChange={(e) => onChange({
                value_number: e.target.value === "" ? null : e.target.value,
              })}
              disabled={disabled}
              placeholder="—"
            />
            {unit && <span className="adm-pav__unit">{unit}</span>}
          </div>
        );

      case "boolean": {
        /* Three-state: undefined / true / false. Undefined = don't save. */
        const raw = value.value_boolean == null ? "" : String(value.value_boolean);
        return (
          <select
            value={raw}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                value_boolean: v === "" ? null : v === "true",
              });
            }}
            disabled={disabled}
          >
            <option value="">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      }

      case "select":
      case "color": {
        const currentId = value.attribute_value_id || "";
        const currentVal = allowed_values.find((v) => v.id === currentId);
        return (
          <div className="adm-pav__select-wrap">
            {type === "color" && currentVal?.hex_color && (
              <span
                className="adm-pav__swatch"
                style={{ background: currentVal.hex_color }}
                title={currentVal.label}
              />
            )}
            <select
              value={currentId}
              onChange={(e) => onChange({
                attribute_value_id: e.target.value || null,
              })}
              disabled={disabled}
            >
              <option value="">— Not set —</option>
              {allowed_values.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>
        );
      }

      case "multi_select": {
        const selected = new Set(value.attribute_value_ids || []);
        if (allowed_values.length === 0) {
          return <em className="adm-pav__muted">No values defined for this attribute.</em>;
        }
        return (
          <div className="adm-pav__multi">
            {allowed_values.map((v) => (
              <label key={v.id} className={"adm-pav__chip" + (selected.has(v.id) ? " on" : "")}>
                <input
                  type="checkbox"
                  checked={selected.has(v.id)}
                  onChange={() => onToggleMulti(v.id)}
                  disabled={disabled}
                />
                <span>{v.label}</span>
              </label>
            ))}
          </div>
        );
      }

      default:
        return <em className="adm-pav__muted">Unsupported type: {type}</em>;
    }
  })();

  return (
    <div className="adm-pav__row">
      <div className="adm-pav__row-label">
        <b>{attribute.name}</b>
        <small>{typeHint(type, unit)}</small>
      </div>
      <div className="adm-pav__row-input">{inputEl}</div>
    </div>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

function typeHint(type, unit) {
  switch (type) {
    case "text":         return "Text";
    case "number":       return unit ? `Number (${unit})` : "Number";
    case "boolean":      return "Yes / No";
    case "select":       return "Single choice";
    case "multi_select": return "Multiple choices";
    case "color":        return "Color";
    default:             return type;
  }
}

/**
 * Turn raw pav rows into a keyed assignments map for local state.
 * Groups multi_select rows into arrays.
 */
function buildAssignmentMap(pavRows) {
  const map = {};
  for (const row of pavRows || []) {
    const attrId = row.attribute_id;
    const type = row.attribute?.type;

    if (type === "multi_select") {
      if (!map[attrId]) map[attrId] = { attribute_value_ids: [] };
      if (row.attribute_value_id) {
        map[attrId].attribute_value_ids.push(row.attribute_value_id);
      }
    } else {
      map[attrId] = {
        value_text:         row.value_text,
        value_number:       row.value_number,
        value_boolean:      row.value_boolean,
        attribute_value_id: row.attribute_value_id,
      };
    }
  }
  return map;
}