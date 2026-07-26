import { useCallback, useRef, useState } from "react";
import { AlertTriangle, Image as ImageIcon, Loader2, Plus, Upload, X } from "lucide-react";
import { deleteProductImage, uploadProductImage, validateImageFile } from "../../lib/uploadImage.js";

/**
 * ImageUploader
 *
 * Manages a primary image plus up to 3 additional gallery images.
 * The parent owns the state and passes:
 *   mainImage         \u2014 string URL (or "")
 *   gallery           \u2014 string[] of extra URLs
 *   onMainChange      \u2014 (url) => void
 *   onGalleryChange   \u2014 (urls) => void
 *   skuHint           \u2014 grouping key for the storage path
 *
 * Drag-and-drop, click-to-browse, upload progress spinner,
 * remove button per image, inline error surface.
 */
export default function ImageUploader({
  mainImage, gallery = [], onMainChange, onGalleryChange, skuHint,
}) {
  const [busySlot, setBusySlot] = useState(null); // "main" | 0 | 1 | 2
  const [error, setError] = useState(null);
  const mainInputRef = useRef(null);
  const galleryInputRefs = [useRef(null), useRef(null), useRef(null)];

  const uploadTo = useCallback(async (file, slot) => {
    setError(null);
    const check = validateImageFile(file);
    if (!check.ok) { setError(check.reason); return; }
    setBusySlot(slot);
    try {
      const { publicUrl } = await uploadProductImage(file, { skuHint });
      if (slot === "main") {
        // If replacing an existing main image, try to delete the old one
        // (best-effort \u2014 don't fail the whole op if delete fails)
        if (mainImage) { deleteProductImage(mainImage).catch(() => {}); }
        onMainChange(publicUrl);
      } else {
        const nextGallery = [...gallery];
        const oldUrl = nextGallery[slot];
        nextGallery[slot] = publicUrl;
        if (oldUrl) { deleteProductImage(oldUrl).catch(() => {}); }
        onGalleryChange(nextGallery.filter(Boolean));
      }
    } catch (err) {
      setError(err.message || "Upload failed. Check your connection and try again.");
    } finally {
      setBusySlot(null);
    }
  }, [gallery, mainImage, onGalleryChange, onMainChange, skuHint]);

  const removeMain = useCallback(async () => {
    if (!mainImage) return;
    setBusySlot("main");
    try {
      await deleteProductImage(mainImage).catch(() => {}); // best-effort
      onMainChange("");
    } finally {
      setBusySlot(null);
    }
  }, [mainImage, onMainChange]);

  const removeGalleryAt = useCallback(async (i) => {
    setBusySlot(i);
    try {
      const url = gallery[i];
      if (url) await deleteProductImage(url).catch(() => {});
      onGalleryChange(gallery.filter((_, idx) => idx !== i));
    } finally {
      setBusySlot(null);
    }
  }, [gallery, onGalleryChange]);

  function onDropTo(slot, e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("adm-uploader__slot--drag");
    const file = e.dataTransfer.files?.[0];
    if (file) uploadTo(file, slot);
  }
  function onDragOver(e) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("adm-uploader__slot--drag"); }
  function onDragLeave(e) { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove("adm-uploader__slot--drag"); }

  const filledGallery = gallery.slice(0, 3);
  const emptyCount = 3 - filledGallery.length;

  return (
    <div className="adm-uploader">
      {/* Main image slot */}
      <div
        className="adm-uploader__slot adm-uploader__slot--main"
        onClick={() => busySlot !== "main" && mainInputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDropTo("main", e)}
      >
        <input
          ref={mainInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadTo(f, "main");
            e.target.value = "";
          }}
        />
        {busySlot === "main" ? (
          <span className="adm-uploader__busy"><Loader2 size={22} className="adm-spin" /></span>
        ) : mainImage ? (
          <>
            <img src={mainImage} alt="Primary product image"
                 onError={(e) => { e.target.style.opacity = 0.3; }} />
            <button
              type="button"
              className="adm-uploader__remove"
              onClick={(e) => { e.stopPropagation(); removeMain(); }}
              aria-label="Remove main image"
            >
              <X size={13} />
            </button>
          </>
        ) : (
          <div className="adm-uploader__hint">
            <Upload size={22} strokeWidth={1.4} />
            <b>Upload primary image</b>
            <small>Click or drag · JPEG / PNG / WebP up to 5 MB</small>
          </div>
        )}
      </div>

      {/* Gallery row */}
      <div className="adm-uploader__row">
        {filledGallery.map((url, i) => (
          <div
            key={"g" + i}
            className="adm-uploader__slot adm-uploader__slot--sm"
            onClick={() => busySlot !== i && galleryInputRefs[i].current?.click()}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={(e) => onDropTo(i, e)}
          >
            <input
              ref={galleryInputRefs[i]}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadTo(f, i);
                e.target.value = "";
              }}
            />
            {busySlot === i ? (
              <span className="adm-uploader__busy"><Loader2 size={16} className="adm-spin" /></span>
            ) : (
              <>
                <img src={url} alt="" onError={(e) => { e.target.style.opacity = 0.3; }} />
                <button
                  type="button"
                  className="adm-uploader__remove"
                  onClick={(e) => { e.stopPropagation(); removeGalleryAt(i); }}
                  aria-label={`Remove gallery image ${i + 1}`}
                >
                  <X size={11} />
                </button>
              </>
            )}
          </div>
        ))}

        {/* Empty gallery slots \u2014 one clickable "add" for the next slot,
            plus placeholder outlines for the rest so alignment stays clean */}
        {emptyCount > 0 && Array.from({ length: emptyCount }, (_, k) => {
          const slotIndex = filledGallery.length + k;
          const isClickable = k === 0 && !busySlot;
          return (
            <div
              key={"e" + k}
              className={"adm-uploader__slot adm-uploader__slot--sm adm-uploader__slot--empty" + (isClickable ? " adm-uploader__slot--clickable" : "")}
              onClick={() => {
                if (!isClickable) return;
                galleryInputRefs[slotIndex]?.current?.click();
              }}
              onDragOver={isClickable ? onDragOver : undefined}
              onDragLeave={isClickable ? onDragLeave : undefined}
              onDrop={isClickable ? (e) => onDropTo(slotIndex, e) : undefined}
            >
              {isClickable ? (
                <>
                  <input
                    ref={galleryInputRefs[slotIndex]}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadTo(f, slotIndex);
                      e.target.value = "";
                    }}
                  />
                  <Plus size={16} />
                </>
              ) : (
                <ImageIcon size={14} strokeWidth={1.2} />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="adm-uploader__error">
          <AlertTriangle size={13} /> {error}
        </div>
      )}
    </div>
  );
}