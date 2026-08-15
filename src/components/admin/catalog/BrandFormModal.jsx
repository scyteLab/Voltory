import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { validateBrandSlug } from "../../../lib/brandsAdmin.js";

/**
 * BrandFormModal
 *
 * Both id and name are locked in edit mode because:
 *   · URL /brand/:id — renaming would break bookmarks
 *   · products.brand references brand.name — renaming would orphan
 *
 * Only the logo URL can be updated post-creation.
 */
export default function BrandFormModal({ brand, onClose, onSubmit }) {
  const isEdit = !!brand;
  const [id, setId]     = useState(brand?.id   || "");
  const [name, setName] = useState(brand?.name || "");
  const [logo, setLogo] = useState(brand?.logo || "");

  const [error, setError]           = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const firstFieldRef               = useRef(null);

  useEffect(() => {
    setTimeout(() => firstFieldRef.current?.focus(), 50);
  }, []);

  // Auto-derive slug from name in create mode
  function onNameChange(v) {
    setName(v);
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
      const slugErr = validateBrandSlug(id);
      if (slugErr) { setError(slugErr); return; }
      if (!name.trim()) { setError("Brand name is required"); return; }
    }

    setSubmitting(true);
    const payload = isEdit
      ? { logo }
      : { id, name, logo };
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
          <h2>{isEdit ? "Edit brand" : "New brand"}</h2>
          <button type="button" className="cat-modal__x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="cat-modal__body">
          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="brand-name">Brand name</label>
            <input
              id="brand-name"
              ref={!isEdit ? firstFieldRef : null}
              type="text"
              className="hb-input"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Hisense"
              disabled={isEdit}
              required
              maxLength={60}
            />
            {isEdit ? (
              <p className="cat-modal__hint cat-modal__hint--lock">
                <b>Locked.</b> Every product on NAVEN links to this brand by name.
                Renaming would orphan those products. If you truly need to rename, delete
                and re-create the brand and reassign products.
              </p>
            ) : (
              <p className="cat-modal__hint">
                This appears on the storefront and in product listings. <b>Cannot be changed later.</b>
              </p>
            )}
          </div>

          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="brand-slug">Slug</label>
            <input
              id="brand-slug"
              type="text"
              className="hb-input"
              value={id}
              onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="hisense"
              disabled={isEdit}
              maxLength={40}
              required
            />
            {isEdit ? (
              <p className="cat-modal__hint cat-modal__hint--lock">
                <b>Locked.</b> This is part of the URL <code>/brand/{id}</code>.
                Changing it after creation would break bookmarks and external links.
              </p>
            ) : (
              <p className="cat-modal__hint">
                URL: <code>/brand/{id || "your-slug"}</code>. Lowercase letters, digits, hyphens only. <b>Cannot be changed later.</b>
              </p>
            )}
          </div>

          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="brand-logo">Logo URL</label>
            <input
              id="brand-logo"
              ref={isEdit ? firstFieldRef : null}
              type="text"
              className="hb-input"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="/brand-logos/hisense.png or https://…"
            />
            <p className="cat-modal__hint">
              Path or full URL. Recommended: transparent PNG or SVG, roughly 200x80 aspect ratio, dark logo on transparent background.
            </p>
            {logo && (
              <div className="brand-modal__preview">
                <img src={logo} alt="Logo preview" onError={(e) => { e.currentTarget.style.opacity = "0.3"; }} />
              </div>
            )}
          </div>

          {error && <div className="cat-modal__err">{error}</div>}

          <div className="cat-modal__actions">
            <button type="button" onClick={onClose} className="adm-btn adm-btn--secondary">
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create brand"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}