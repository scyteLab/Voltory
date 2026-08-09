import { BadgeCheck, Check, RotateCcw, Star, Trash2, X } from "lucide-react";

/**
 * ReviewRow \u2014 one card in the admin queue.
 *
 * Shows product thumbnail + name + SKU, customer info, rating,
 * title, body, timestamps. Action buttons switch depending on
 * current status:
 *   \u00B7 pending  \u2192 Approve, Reject, Delete
 *   \u00B7 approved \u2192 Move back to pending, Reject, Delete
 *   \u00B7 rejected \u2192 Approve (reconsider), Move back to pending, Delete
 */
export default function ReviewRow({ review, onApprove, onReject, onUnapprove, onDelete, busy }) {
  const dateStr = new Date(review.createdAt).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <li className={"revq-row revq-row--" + review.status}>
      <div className="revq-row__top">
        <div className="revq-row__prod">
          {review.productImage && (
            <img src={review.productImage} alt="" />
          )}
          <div>
            <b>{review.productName}</b>
            <small className="mono">{review.productSku}</small>
          </div>
        </div>

        <div className="revq-row__meta">
          <div className="revq-row__stars" aria-label={`${review.rating} of 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={14}
                fill={n <= review.rating ? "#f59e0b" : "none"}
                stroke={n <= review.rating ? "#f59e0b" : "#cbd5e1"}
              />
            ))}
          </div>
          <span className={`revs__status revs__status--${review.status}`}>
            {review.status === "approved" && "Approved"}
            {review.status === "pending"  && "Pending"}
            {review.status === "rejected" && "Rejected"}
          </span>
        </div>
      </div>

      <div className="revq-row__body">
        {review.title && <b className="revq-row__title">{review.title}</b>}
        <p className="revq-row__text">{review.body}</p>
      </div>

      <div className="revq-row__foot">
        <div className="revq-row__author">
          <b>{review.customerName}</b>
          {review.customerPhone && <span className="mono revq-row__phone">{review.customerPhone}</span>}
          {review.verifiedBuyer && (
            <span className="rev-card__verified"><BadgeCheck size={12} /> Verified buyer</span>
          )}
          <span className="revq-row__date">{dateStr}</span>
        </div>

        <div className="revq-row__actions">
          {review.status !== "approved" && (
            <button
              type="button"
              className="revq-btn revq-btn--approve"
              onClick={() => onApprove(review.id)}
              disabled={busy}
            >
              <Check size={14} /> {review.status === "rejected" ? "Reconsider" : "Approve"}
            </button>
          )}
          {review.status !== "rejected" && (
            <button
              type="button"
              className="revq-btn revq-btn--reject"
              onClick={() => onReject(review)}
              disabled={busy}
            >
              <X size={14} /> Reject
            </button>
          )}
          {review.status !== "pending" && (
            <button
              type="button"
              className="revq-btn"
              onClick={() => onUnapprove(review.id)}
              disabled={busy}
              title="Move back to pending"
            >
              <RotateCcw size={14} /> Pending
            </button>
          )}
          <button
            type="button"
            className="revq-btn revq-btn--danger"
            onClick={() => onDelete(review)}
            disabled={busy}
            title="Delete permanently"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {review.status === "rejected" && review.adminNote && (
        <div className="revq-row__note">
          <b>Rejection reason:</b> {review.adminNote}
        </div>
      )}
    </li>
  );
}