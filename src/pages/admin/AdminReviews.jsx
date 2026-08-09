import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAdminReviews } from "../../hooks/useAdminReviews.js";
import ReviewRow from "../../components/admin/reviews/ReviewRow.jsx";
import RejectModal from "../../components/admin/reviews/RejectModal.jsx";

/**
 * AdminReviews \u2014 /admin/reviews
 *
 * Tabbed queue:
 *   \u00B7 Pending (default) \u2014 the moderation inbox
 *   \u00B7 Approved         \u2014 what's live on the storefront
 *   \u00B7 Rejected         \u2014 audit trail
 *   \u00B7 All              \u2014 combined
 *
 * Each row lets the admin approve, reject (with reason), move back
 * to pending, or hard-delete. Every action fires the products.rating
 * recompute trigger so aggregate stays honest.
 */
export default function AdminReviews() {
  const {
    status, setStatus,
    reviews, counts, loading, error,
    approve, reject, unapprove, remove,
  } = useAdminReviews("pending");

  const [rejecting, setRejecting] = useState(null); // review being rejected
  const [busyId, setBusyId] = useState(null);
  const [actionErr, setActionErr] = useState(null);

  async function handleApprove(id) {
    setBusyId(id);
    setActionErr(null);
    const res = await approve(id);
    setBusyId(null);
    if (!res.ok) setActionErr(res.error);
  }

  function openReject(review) {
    setActionErr(null);
    setRejecting(review);
  }
  async function submitReject(note) {
    setBusyId(rejecting.id);
    const res = await reject(rejecting.id, note);
    setBusyId(null);
    return res;
  }

  async function handleUnapprove(id) {
    setBusyId(id);
    setActionErr(null);
    const res = await unapprove(id);
    setBusyId(null);
    if (!res.ok) setActionErr(res.error);
  }

  async function handleDelete(review) {
    if (!window.confirm(`Delete this review permanently? Cannot be undone.`)) return;
    setBusyId(review.id);
    setActionErr(null);
    const res = await remove(review.id);
    setBusyId(null);
    if (!res.ok) setActionErr(res.error);
  }

  const TABS = [
    { id: "pending",  label: "Pending",  count: counts.pending },
    { id: "approved", label: "Approved", count: counts.approved },
    { id: "rejected", label: "Rejected", count: counts.rejected },
    { id: "all",      label: "All",      count: counts.pending + counts.approved + counts.rejected },
  ];

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Reviews</h1>
          <p>Moderate customer reviews. Approved reviews appear publicly on product pages and count toward the star rating.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="revq-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={status === t.id}
            className={"revq-tab" + (status === t.id ? " revq-tab--on" : "")}
            onClick={() => setStatus(t.id)}
          >
            {t.label}
            {t.count > 0 && <span className="revq-tab__count">{t.count}</span>}
          </button>
        ))}
      </div>

      {error && <div className="hb__err">Couldn't load reviews: {error}</div>}
      {actionErr && <div className="hb__err">{actionErr}</div>}

      {loading && reviews.length === 0 ? (
        <div className="hb__loading">Loading reviews\u2026</div>
      ) : reviews.length === 0 ? (
        <div className="cat-empty">
          <MessageSquare size={40} strokeWidth={1.2} />
          <h2>
            {status === "pending"  && "No reviews waiting"}
            {status === "approved" && "No approved reviews yet"}
            {status === "rejected" && "No rejected reviews"}
            {status === "all"      && "No reviews yet"}
          </h2>
          <p>
            {status === "pending"
              ? "Nothing to moderate right now. New reviews will appear here."
              : "Once customers write reviews they'll show up in this queue."}
          </p>
        </div>
      ) : (
        <ul className="revq-list">
          {reviews.map((r) => (
            <ReviewRow
              key={r.id}
              review={r}
              onApprove={handleApprove}
              onReject={openReject}
              onUnapprove={handleUnapprove}
              onDelete={handleDelete}
              busy={busyId === r.id}
            />
          ))}
        </ul>
      )}

      {rejecting && (
        <RejectModal
          review={rejecting}
          onClose={() => setRejecting(null)}
          onSubmit={submitReject}
        />
      )}
    </div>
  );
}