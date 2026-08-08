import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import IconPicker from "./IconPicker.jsx";
import { validateSlug } from "../../../lib/categoriesAdmin.js";

/**
 * CategoryFormModal
 *
 * Handles both create and edit. When `category` is null → create mode
 * (slug field editable). When category is passed → edit mode (slug
 * shown but disabled, because changing a PK that products reference
 * is a whole different migration operation we don't do inline).
 *
 * onSubmit(input): async, returns { ok, error } from the parent.
 * The modal displays the error inline and stays open on failure.
 */
export default function CategoryFormModal({ category, onClose, onSubmit }) {
  const isEdit = !!category;
  const [id, setId]         = useState(category?.id || "");
  const [label, setLabel]   = useState(category?.label || "");
  const [icon, setIcon]     = useState(category?.icon || "Package");
  const [blurb, setBlurb]   = useState(category?.blurb || "");
  const [hot, setHot]       = useState(!!category?.hot);

  const [error, setError]   = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const labelRef = useRef(null);

  useEffect(() => {
    // Focus first field on open
    setTimeout(() => (isEdit ? labelRef.current?.focus() : null), 50);
  }, [isEdit]);

  // Auto-derive slug from label in create mode as the user types
  function onLabelChange(v) {
    setLabel(v);
    if (!isEdit) {
      const derived = v.toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
      setId(derived);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!isEdit) {
      const slugErr = validateSlug(id);
      if (slugErr) { setError(slugErr); return; }
    }
    if (!label.trim()) { setError("Label is required"); return; }

    setSubmitting(true);
    const payload = isEdit
      ? { label, icon, blurb, hot }
      : { id, label, icon, blurb, hot };
    const res = await onSubmit(payload);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Something went wrong");
      return;
    }
    onClose();
  }

  return (
    <div className="cat-modal__scrim" onClick={onClose}>
      <div className="cat-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="cat-modal__head">
          <h2>{isEdit ? "Edit category" : "New category"}</h2>
          <button type="button" className="cat-modal__x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="cat-modal__body">
          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="cat-label">Label</label>
            <input
              id="cat-label"
              ref={labelRef}
              type="text"
              className="hb-input"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="e.g. Refrigerators & Freezers"
              required
            />
            <p className="cat-modal__hint">Shown in the sidebar and category headings.</p>
          </div>

          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="cat-slug">Slug</label>
            <input
              id="cat-slug"
              type="text"
              className="hb-input"
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="refrigerators-freezers"
              disabled={isEdit}
              maxLength={40}
              required
            />
            {isEdit ? (
              <p className="cat-modal__hint cat-modal__hint--lock">
                <b>Locked.</b> The slug is part of every product's link to this category.
                Changing it after creation would break existing URLs and detach linked products.
                URL: <code>/category/{id}</code>
              </p>
            ) : (
              <p className="cat-modal__hint">
                URL: <code>/category/{id || "your-slug"}</code>. Lowercase letters, digits, hyphens only. <b>Cannot be changed later.</b>
              </p>
            )}
          </div>

          <div className="cat-modal__field">
            <label className="hb-lbl">Icon</label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="cat-blurb">Short description</label>
            <textarea
              id="cat-blurb"
              className="hb-input"
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              rows={2}
              placeholder="One-liner describing what's in this category"
              maxLength={200}
            />
          </div>

          <div className="cat-modal__field cat-modal__field--row">
            <label className="cat-modal__switch">
              <input
                type="checkbox"
                checked={hot}
                onChange={(e) => setHot(e.target.checked)}
              />
              <span>Show "Hot" badge in sidebar</span>
            </label>
          </div>

          {error && <div className="cat-modal__err">{error}</div>}

          <div className="cat-modal__actions">
            <button type="button" onClick={onClose} className="adm-btn adm-btn--secondary">
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={submitting}>
              {submitting ? "Saving\u2026" : isEdit ? "Save changes" : "Create category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}