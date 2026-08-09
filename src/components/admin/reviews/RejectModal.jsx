import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

/**
 * RejectModal \u2014 short modal for rejecting a review.
 * The reason is optional but strongly encouraged \u2014 it's shown to
 * the customer on their /account/reviews page so they know why.
 *
 * A few quick-pick presets speed up common cases.
 */

const PRESETS = [
  "Off-topic",
  "Contains inappropriate language",
  "Contains spam or promotional content",
  "Not about this product",
  "Duplicate review",
];

export default function RejectModal({ review, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const areaRef = useRef(null);

  useEffect(() => {
    setTimeout(() => areaRef.current?.focus(), 50);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await onSubmit(note);
    setSubmitting(false);
    if (!res.ok) { setError(res.error || "Something went wrong"); return; }
    onClose();
  }

  return (
    <div className="cat-modal__scrim" onClick={onClose}>
      <div className="cat-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="cat-modal__head">
          <h2>Reject review</h2>
          <button type="button" className="cat-modal__x" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="cat-modal__body">
          <p className="cat-modal__hint">
            You're rejecting <b>{review.customerName}</b>'s review of <b>{review.productName}</b>. The customer sees the reason on their My Reviews page.
          </p>

          <div className="cat-modal__field">
            <label className="hb-lbl">Quick presets</label>
            <div className="revq-presets">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={"revq-preset" + (note === p ? " revq-preset--on" : "")}
                  onClick={() => setNote(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="cat-modal__field">
            <label className="hb-lbl" htmlFor="rej-note">Reason (optional)</label>
            <textarea
              id="rej-note"
              ref={areaRef}
              className="hb-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Why is this being rejected?"
              maxLength={300}
            />
          </div>

          {error && <div className="cat-modal__err">{error}</div>}

          <div className="cat-modal__actions">
            <button type="button" onClick={onClose} className="adm-btn adm-btn--secondary">
              Cancel
            </button>
            <button type="submit" className="adm-btn adm-btn--primary" disabled={submitting}>
              {submitting ? "Rejecting\u2026" : "Reject review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}