import { Link } from "react-router-dom";
import { MessageSquare, Star, Trash2 } from "lucide-react";
import { useCustomerReviews } from "../../hooks/useCustomerReviews.js";

/**
 * AccountReviews — /account/reviews
 *
 * Every review the customer has written, all statuses. Useful for
 * seeing "which of my reviews are still pending" and for deleting
 * old reviews.
 *
 * Editing happens on the product page (with the write form). This
 * page just lists + delete.
 */
export default function AccountReviews() {
  const { reviews, loading, remove } = useCustomerReviews();

  async function handleDelete(review) {
    if (!window.confirm(`Delete your review of "${review.productName}"?`)) return;
    await remove(review.id);
  }

  return (
    <div className="ord-list">
      <header className="ord-list__head">
        <h1>My Reviews</h1>
        <p>
          {loading
            ? "Loading…"
            : reviews.length === 0
            ? "You haven't reviewed any products yet."
            : `${reviews.length} review${reviews.length === 1 ? "" : "s"} written.`}
        </p>
      </header>

      {reviews.length === 0 && !loading ? (
        <div className="ord-empty">
          <MessageSquare size={48} strokeWidth={1.1} />
          <h2>Nothing here yet</h2>
          <p>After you receive a product, come back and let other shoppers know what you think.</p>
          <Link to="/account/orders" className="btn-shop">View my orders</Link>
        </div>
      ) : (
        <ul className="myrev-list">
          {reviews.map((r) => (
            <li key={r.id} className="myrev-row">
              <Link to={r.productSlug ? `/p/${r.productSlug}` : "/"} className="myrev-row__prod">
                {r.productImage && <img src={r.productImage} alt="" />}
                <div>
                  <b>{r.productName}</b>
                  <small>Written {new Date(r.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}</small>
                </div>
              </Link>

              <div className="myrev-row__body">
                <div className="myrev-row__stars" aria-label={`${r.rating} of 5`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={13}
                      fill={n <= r.rating ? "#f59e0b" : "none"}
                      stroke={n <= r.rating ? "#f59e0b" : "#cbd5e1"}
                    />
                  ))}
                  <span className={`revs__status revs__status--${r.status}`}>
                    {r.status === "approved" && "Published"}
                    {r.status === "pending"  && "Awaiting moderation"}
                    {r.status === "rejected" && "Not published"}
                  </span>
                </div>
                {r.title && <b className="myrev-row__title">{r.title}</b>}
                <p className="myrev-row__excerpt">{r.body.length > 220 ? r.body.slice(0, 220) + "…" : r.body}</p>
                {r.status === "rejected" && r.adminNote && (
                  <p className="myrev-row__adminnote"><b>Reason:</b> {r.adminNote}</p>
                )}
              </div>

              <div className="myrev-row__actions">
                <Link to={r.productSlug ? `/p/${r.productSlug}#reviews-heading` : "/"} className="btn-ghost">
                  View / Edit
                </Link>
                <button
                  type="button"
                  className="btn-ghost btn-ghost--danger"
                  onClick={() => handleDelete(r)}
                  title="Delete"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}