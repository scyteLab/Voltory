import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, Calendar, Check, Gift, Image as ImageIcon,
  Loader2, Save, Search, Upload, X,
} from "lucide-react";
import { useCatalog } from "../../context/CatalogContext.jsx";
import { usePermission } from "../../lib/permissions.js";
import { adminToast } from "../../lib/adminToast.js";
import {
  fetchOfferById,
  uploadGiftImage,
  deleteGiftImage,
} from "../../lib/adminOffersClient.js";

/**
 * AdminOfferEdit — create or edit a promotional offer.
 *
 * Routes:
 *   /admin/offers/new       — create mode
 *   /admin/offers/:id       — edit mode
 *
 * Form fields:
 *   · Product picker (search-and-select)  — disabled in edit mode
 *   · Offer title
 *   · Gift description
 *   · Gift image upload (optional)
 *   · Multiply-by-qty toggle
 *   · End date picker (required)
 *   · Active toggle
 */
export default function AdminOfferEdit() {
  const { id } = useParams();
  const isEdit = id !== "new";
  const navigate = useNavigate();

  const { products, upsertOffer, loading: catalogLoading } = useCatalog();
  const canManage = usePermission("catalog.offers.manage");

  const [form, setForm] = useState({
    product_sku: "",
    title: "",
    gift_description: "",
    gift_image: "",
    multiply_by_qty: false,
    ends_at: "",
    is_active: true,
  });

  const [loading, setLoading]     = useState(isEdit);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [confirmRemoveImage, setConfirmRemoveImage] = useState(false);

  /* ---- Load existing offer in edit mode ---- */

  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const res = await fetchOfferById(id);
      if (cancelled) return;

      if (!res.ok) {
        setError(res.error);
      } else {
        const offer = res.data;
        setForm({
          product_sku:      offer.product_sku,
          title:            offer.title,
          gift_description: offer.gift_description,
          gift_image:       offer.gift_image || "",
          multiply_by_qty:  !!offer.multiply_by_qty,
          ends_at:          offer.ends_at ? offer.ends_at.slice(0, 16) : "", // for datetime-local
          is_active:        !!offer.is_active,
        });
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [id, isEdit]);

  /* ---- Product picker (filter by search) ---- */

  const productsWithOffers = useMemo(() => {
    /* In create mode, we need to know which products already have
       offers so we don't let admin pick them (UNIQUE constraint would
       fail). In edit mode, the current offer's product is exempt. */
    return new Set(); // NOTE: We could pass this from context to be strict,
                     // but backend enforces UNIQUE, so we just show the error.
  }, []);

  const filteredProducts = useMemo(() => {
    if (isEdit) return []; // no picker in edit mode
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 10);
    return products
      .filter((p) =>
        p.name?.toLowerCase().includes(q) ||
        p.sku?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q)
      )
      .slice(0, 15);
  }, [products, productSearch, isEdit]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.sku === form.product_sku) || null;
  }, [products, form.product_sku]);

  /* ---- Field handlers ---- */

  function field(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  }

  /* ---- Image upload ---- */

  async function onImageSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageUploading(true);
    setError(null);

    /* If there's an old image, delete it first (best effort) */
    if (form.gift_image) {
      try { await deleteGiftImage(form.gift_image); } catch { /* ignore */ }
    }

    const res = await uploadGiftImage(file, isEdit ? id : "new");
    setImageUploading(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    field("gift_image", res.data.publicUrl);
    adminToast.success("Gift image uploaded.");
  }

  async function onRemoveImage() {
    if (!form.gift_image) return;
    setImageUploading(true);
    try {
      await deleteGiftImage(form.gift_image);
    } catch { /* ignore */ }
    field("gift_image", "");
    setImageUploading(false);
    setConfirmRemoveImage(false);
    adminToast.success("Gift image removed.");
  }

  /* ---- Save ---- */

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    /* Client-side validation */
    if (!form.product_sku)      return setError("Choose a product.");
    if (!form.title.trim())     return setError("Offer title is required.");
    if (!form.gift_description.trim()) return setError("Gift description is required.");
    if (!form.ends_at)          return setError("End date is required.");

    const endsAt = new Date(form.ends_at);
    if (isNaN(endsAt.getTime())) return setError("End date is invalid.");
    if (endsAt.getTime() < Date.now()) return setError("End date must be in the future.");

    setSaving(true);
    try {
      const payload = {
        ...(isEdit && { id }),
        product_sku:      form.product_sku,
        title:            form.title.trim(),
        gift_description: form.gift_description.trim(),
        gift_image:       form.gift_image || null,
        multiply_by_qty:  !!form.multiply_by_qty,
        ends_at:          endsAt.toISOString(),
        is_active:        !!form.is_active,
      };

      await upsertOffer(payload);
      adminToast.success(isEdit ? "Offer updated." : "Offer created.");
      navigate("/admin/offers");
    } catch (err) {
      setError(err.message || "Failed to save offer.");
    } finally {
      setSaving(false);
    }
  }

  /* ---- Render ---- */

  if (loading || catalogLoading) {
    return (
      <div className="adm-page">
        <div className="adm-list-empty">
          <Loader2 size={24} className="adm-spinner" /> Loading offer…
        </div>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <Link to="/admin/offers" className="adm-back-link">
            <ArrowLeft size={13} /> Back to offers
          </Link>
          <h1>
            <Gift size={22} />
            {isEdit ? "Edit Offer" : "New Offer"}
          </h1>
        </div>
      </header>

      <form onSubmit={onSubmit} className="adm-form adm-form--wide">

        {/* Product selection */}
        <section className="adm-form-section">
          <h2>Product</h2>
          {isEdit ? (
            <div className="adm-form-readonly">
              <b>{selectedProduct?.name || form.product_sku}</b>
              <small>{selectedProduct?.brand} · {form.product_sku}</small>
              <p className="adm-form-hint">
                To change the product, delete this offer and create a new one.
              </p>
            </div>
          ) : (
            <>
              <div className="adm-form-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search by product name, SKU, or brand…"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  disabled={saving}
                />
              </div>
              <div className="adm-form-picker">
                {filteredProducts.length === 0 && productSearch && (
                  <div className="adm-form-picker__empty">No products match your search.</div>
                )}
                {filteredProducts.map((p) => (
                  <button
                    key={p.sku}
                    type="button"
                    className={
                      "adm-form-picker__item" +
                      (form.product_sku === p.sku ? " adm-form-picker__item--selected" : "")
                    }
                    onClick={() => field("product_sku", p.sku)}
                    disabled={saving}
                  >
                    {p.image ? (
                      <img src={p.image} alt="" loading="lazy" />
                    ) : (
                      <div className="adm-form-picker__noimg"><ImageIcon size={14} /></div>
                    )}
                    <div>
                      <b>{p.name}</b>
                      <small>{p.brand} · {p.sku}</small>
                    </div>
                    {form.product_sku === p.sku && (
                      <Check size={16} className="adm-form-picker__check" />
                    )}
                  </button>
                ))}
              </div>
              <p className="adm-form-hint">
                Only one offer per product allowed. If a product already has an offer, this save will fail with a friendly error.
              </p>
            </>
          )}
        </section>

        {/* Offer details */}
        <section className="adm-form-section">
          <h2>Offer details</h2>

          <label className="adm-form-field">
            <span>Offer title *</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => field("title", e.target.value)}
              placeholder='e.g. "Buy This AC, Get FREE Installation"'
              maxLength={200}
              required
              disabled={saving}
            />
            <small className="adm-form-hint">
              Shown as a banner on the product page and deals page ({form.title.length}/200).
            </small>
          </label>

          <label className="adm-form-field">
            <span>Gift description *</span>
            <textarea
              value={form.gift_description}
              onChange={(e) => field("gift_description", e.target.value)}
              placeholder='e.g. "1 x 5kg Bag of Long Grain Rice"'
              rows={2}
              maxLength={500}
              required
              disabled={saving}
            />
            <small className="adm-form-hint">
              What the customer receives ({form.gift_description.length}/500).
            </small>
          </label>

          {/* Image upload */}
          <div className="adm-form-field">
            <span>Gift image (optional)</span>
            {form.gift_image ? (
              <div className="adm-form-image-preview">
                <img src={form.gift_image} alt="Gift preview" />
                <button
                  type="button"
                  className="adm-btn adm-btn--ghost-danger adm-btn--sm"
                  onClick={() => setConfirmRemoveImage(true)}
                  disabled={saving || imageUploading}
                >
                  <X size={12} /> Remove
                </button>
              </div>
            ) : (
              <label className={"adm-form-upload" + (imageUploading ? " adm-form-upload--busy" : "")}>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={onImageSelected}
                  disabled={saving || imageUploading}
                />
                {imageUploading ? (
                  <><Loader2 size={16} className="adm-spinner" /> Uploading…</>
                ) : (
                  <><Upload size={16} /> Upload gift image (JPEG/PNG/WebP, max 5MB)</>
                )}
              </label>
            )}
            <small className="adm-form-hint">
              Helps customers visualize what they'll receive. Optional but recommended.
            </small>
          </div>
        </section>

        {/* Timing + rules */}
        <section className="adm-form-section">
          <h2>Timing & rules</h2>

          <label className="adm-form-field">
            <span><Calendar size={13} /> End date *</span>
            <input
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => field("ends_at", e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              required
              disabled={saving}
            />
            <small className="adm-form-hint">
              Offer stops appearing after this date and time.
            </small>
          </label>

          <label className="adm-form-toggle">
            <input
              type="checkbox"
              checked={form.multiply_by_qty}
              onChange={(e) => field("multiply_by_qty", e.target.checked)}
              disabled={saving}
            />
            <div>
              <b>Multiply gift with product quantity</b>
              <small>
                If checked: buying 2 qualifying products = 2 gifts. If unchecked: 1 gift per order regardless of qty.
              </small>
            </div>
          </label>

          <label className="adm-form-toggle">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => field("is_active", e.target.checked)}
              disabled={saving}
            />
            <div>
              <b>Offer active</b>
              <small>
                Uncheck to pause without deleting. Paused offers don't appear on the storefront.
              </small>
            </div>
          </label>
        </section>

        {error && (
          <div className="adm-form-error">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        <div className="adm-form-actions">
          <Link to="/admin/offers" className="adm-btn adm-btn--secondary">Cancel</Link>
          <button
            type="submit"
            className="adm-btn adm-btn--primary"
            disabled={saving || !canManage}
          >
            <Save size={13} /> {saving ? "Saving…" : (isEdit ? "Save changes" : "Create offer")}
          </button>
        </div>
      </form>

      {/* Confirm remove image */}
      {confirmRemoveImage && (
        <div className="adm-modal-backdrop" onClick={() => setConfirmRemoveImage(false)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <header className="adm-modal__head">
              <h3>Remove gift image?</h3>
            </header>
            <div className="adm-modal__body">
              <p>The current gift image will be deleted from storage. You can upload a new one afterwards.</p>
            </div>
            <footer className="adm-modal__foot">
              <button
                type="button"
                className="adm-btn adm-btn--secondary"
                onClick={() => setConfirmRemoveImage(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--danger"
                onClick={onRemoveImage}
              >
                Remove image
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}