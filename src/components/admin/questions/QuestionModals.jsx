import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { QUESTION_LIMITS, charCount } from "../../../lib/questionRules.js";

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="cat-modal__scrim" onClick={onClose}>
      <div className="cat-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <header className="cat-modal__head">
          <h2>{title}</h2>
          <button type="button" className="cat-modal__x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Answer (publishes) or edit a published answer. onSubmit(text) → { ok, error? } */
export function AnswerModal({ question, onClose, onSubmit }) {
  const editing = question.status === "published";
  const [text, setText] = useState(question.answer || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 50); }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await onSubmit(text);
    setBusy(false);
    if (!res.ok) { setError(res.error || "Something went wrong"); return; }
    onClose();
  }

  const n = charCount(text.trim());
  return (
    <Modal title={editing ? "Edit answer" : "Answer question"} onClose={onClose}>
      <form onSubmit={submit} className="cat-modal__body">
        <p className="cat-modal__hint">
          <b>{question.productName}</b><br />
          “{question.question}”
        </p>
        <div className="cat-modal__field">
          <label className="hb-lbl" htmlFor="qa-answer">Answer (shown as “NAVEN Team”)</label>
          <textarea id="qa-answer" ref={ref} className="hb-input" rows={6} value={text}
                    onChange={(e) => setText(e.target.value)} maxLength={QUESTION_LIMITS.answerMax + 50} />
          <small className="qaq-modal__count">{n}/{QUESTION_LIMITS.answerMax}</small>
        </div>
        <p className="cat-modal__hint">
          {editing
            ? "Saving updates the public answer. The customer is not emailed again."
            : "Saving publishes the question and answer on the product page and emails the customer (if they gave an email)."}
        </p>
        {error && <div className="cat-modal__err">{error}</div>}
        <div className="cat-modal__actions">
          <button type="button" onClick={onClose} className="adm-btn adm-btn--secondary">Cancel</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy || n < 2}>
            {busy ? "Saving…" : editing ? "Save answer" : "Publish answer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const PRESETS = [
  "Already answered in the product description",
  "Not about this product",
  "Please contact support about orders or deliveries",
  "Contains personal information",
  "Contains inappropriate language",
];

/** Reject with an optional note the customer sees on My Questions. */
export function RejectQuestionModal({ question, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await onSubmit(note);
    setBusy(false);
    if (!res.ok) { setError(res.error || "Something went wrong"); return; }
    onClose();
  }

  return (
    <Modal title="Reject question" onClose={onClose} >
      <form onSubmit={submit} className="cat-modal__body">
        <p className="cat-modal__hint">
          Rejecting <b>{question.customerName}</b>'s question about <b>{question.productName}</b>. It won't be public;
          the customer sees the note on their My Questions page.
        </p>
        <div className="cat-modal__field">
          <label className="hb-lbl">Quick presets</label>
          <div className="revq-presets">
            {PRESETS.map((p) => (
              <button key={p} type="button" className={"revq-preset" + (note === p ? " revq-preset--on" : "")} onClick={() => setNote(p)}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="cat-modal__field">
          <label className="hb-lbl" htmlFor="qa-rej-note">Note to the customer (optional)</label>
          <textarea id="qa-rej-note" className="hb-input" rows={3} value={note} maxLength={300}
                    onChange={(e) => setNote(e.target.value)} placeholder="Why isn't this being published?" />
        </div>
        {error && <div className="cat-modal__err">{error}</div>}
        <div className="cat-modal__actions">
          <button type="button" onClick={onClose} className="adm-btn adm-btn--secondary">Cancel</button>
          <button type="submit" className="adm-btn adm-btn--primary" disabled={busy}>{busy ? "Rejecting…" : "Reject question"}</button>
        </div>
      </form>
    </Modal>
  );
}
