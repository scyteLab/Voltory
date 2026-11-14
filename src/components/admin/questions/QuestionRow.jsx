import { Check, Pencil, RotateCcw, Trash2, X } from "lucide-react";

const STATUS_TEXT = { pending: "Pending", published: "Published", rejected: "Rejected" };
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "");

/**
 * QuestionRow — one card in Admin → Questions.
 *   pending   → Answer (publishes), Reject, Delete
 *   published → Edit answer, Move back to pending, Reject, Delete
 *   rejected  → Answer, Move back to pending, Delete
 * The asker's phone is shown here only (never on the storefront).
 */
export default function QuestionRow({ question: q, onAnswer, onReject, onPending, onDelete, busy }) {
  const published = q.status === "published";
  return (
    <li className={"revq-row revq-row--" + (published ? "approved" : q.status)}>
      <div className="revq-row__top">
        <div className="revq-row__prod">
          {q.productImage && <img src={q.productImage} alt="" />}
          <div>
            {q.productSlug
              ? <a href={`/product/${q.productSlug}#questions`} target="_blank" rel="noreferrer"><b>{q.productName}</b></a>
              : <b>{q.productName}</b>}
            <small className="mono">{q.productSku}</small>
          </div>
        </div>
        <div className="revq-row__meta">
          <span className={`revs__status ${published ? "qaq-status--published" : `revs__status--${q.status}`}`}>
            {STATUS_TEXT[q.status] || q.status}
          </span>
        </div>
      </div>

      <div className="revq-row__body">
        <p className="qaq-row__q">{q.question}</p>
        {q.answer && (
          <div className={"qaq-row__answer" + (published ? "" : " qaq-row__answer--draft")}>
            <small>{published ? `NAVEN Team · ${when(q.answeredAt)}` : "Saved answer (not public)"}</small>
            {q.answer}
          </div>
        )}
      </div>

      <div className="revq-row__foot">
        <div className="revq-row__author">
          <b>{q.customerName}</b>
          {q.customerPhone && <span className="mono revq-row__phone">{q.customerPhone}</span>}
          <span className="revq-row__date">{when(q.createdAt)}</span>
        </div>

        <div className="revq-row__actions">
          {published ? (
            <button type="button" className="revq-btn revq-btn--approve" onClick={() => onAnswer(q)} disabled={busy}>
              <Pencil size={14} /> Edit answer
            </button>
          ) : (
            <button type="button" className="revq-btn revq-btn--approve" onClick={() => onAnswer(q)} disabled={busy}>
              <Check size={14} /> Answer
            </button>
          )}
          {q.status !== "rejected" && (
            <button type="button" className="revq-btn revq-btn--reject" onClick={() => onReject(q)} disabled={busy}>
              <X size={14} /> Reject
            </button>
          )}
          {q.status !== "pending" && (
            <button type="button" className="revq-btn" onClick={() => onPending(q)} disabled={busy} title="Move back to pending">
              <RotateCcw size={14} /> Pending
            </button>
          )}
          <button type="button" className="revq-btn revq-btn--danger" onClick={() => onDelete(q)} disabled={busy}
                  title="Delete permanently" aria-label="Delete question">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {q.status === "rejected" && q.adminNote && (
        <div className="revq-row__note"><b>Note to customer:</b> {q.adminNote}</div>
      )}
    </li>
  );
}
