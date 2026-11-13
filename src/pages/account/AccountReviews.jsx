import { Link } from "react-router-dom";
import { MessageSquare, Star, Trash2 } from "lucide-react";
import { useCustomerReviews } from "../../hooks/useCustomerReviews.js";

const STATUS_TEXT = { pending: "Pending approval", approved: "Published", rejected: "Not published" };
const productUrl = (slug, hash = "") => (slug ? `/product/${slug}${hash}` : "/");

/**
 * AccountReviews — /account/reviews
 *
 *   · "Waiting for your review": delivered products not reviewed yet.
 *   · Every review the customer has written, all statuses, with the
 *     moderation note when one wasn't published.
 *
 * Writing and editing happen on the product page (#write-review).
 * Data: customer-data "my-reviews" (server-checked).
 */
export default function AccountReviews() {
  const { reviews, pendingToReview, loading, error, remove } = useCustomerReviews();

  async function handleDelete(review) {
    if (!window.confirm(`Delete your review of "${review.productName}"?`)) return;
    const res = await remove(review.productSku);
    if (!res.ok) window.alert(res.error);
  }

  const nothing = !loading && reviews.length === 0 && pendingToReview.length === 0;

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

      {error && <div className="myrev-err" role="alert">{error}</div>}

      {pendingToReview.length > 0 && (
        <section className="myrev-waiting" aria-labelledby="myrev-waiting-h">
          <h2 id="myrev-waiting-h">Waiting for your review</h2>
          <ul className="myrev-waiting__list">
            {pendingToReview.map((p) => (
              <li key={p.sku} className="myrev-waiting__row">
                {p.image ? <img src={p.image} alt="" /> : <span className="myrev-waiting__ph" aria-hidden="true" />}
                <div className="myrev-waiting__info">
                  <b>{p.name}</b>
                  <small>Order <span className="mono">{p.orderId}</span></small>
                </div>
                {p.slug && (
                  <Link to={productUrl(p.slug, "#write-review")} className="btn-shop myrev-waiting__btn">
                    <Star size={13} /> Rate &amp; review
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {nothing ? (
        <div className="ord-empty">
          <MessageSquare size={48} strokeWidth={1.1} />
          <h2>Nothing here yet</h2>
          <p>After you receive a product, come back and let other shoppers know what you think.</p>
          <Link to="/account/orders" className="btn-shop">View my orders</Link>
        </div>
      ) : reviews.length > 0 && (
        <ul className="myrev-list">
          {reviews.map((r) => (
            <li key={r.id} className="myrev-row">
              <Link to={productUrl(r.productSlug)} className="myrev-row__prod">
                {r.productImage && <img src={r.productImage} alt="" />}
                <div>
                  <b>{r.productName}</b>
                  <small>Written {new Date(r.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })}</small>
                </div>
              </Link>

              <div className="myrev-row__body">
                <div className="myrev-row__stars" role="img" aria-label={`${r.rating} of 5 stars`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={13}
                      aria-hidden="true"
                      fill={n <= r.rating ? "#f59e0b" : "none"}
                      stroke={n <= r.rating ? "#f59e0b" : "#cbd5e1"}
                    />
                  ))}
                  <span className={`revs__status revs__status--${r.status}`}>{STATUS_TEXT[r.status] || r.status}</span>
                </div>
                {r.title && <b className="myrev-row__title">{r.title}</b>}
                {r.body && (
                  <p className="myrev-row__excerpt">{r.body.length > 220 ? r.body.slice(0, 220) + "…" : r.body}</p>
                )}
                {r.status === "rejected" && r.adminNote && (
                  <p className="myrev-row__adminnote"><b>Reason:</b> {r.adminNote}</p>
                )}
              </div>

              <div className="myrev-row__actions">
                <Link to={productUrl(r.productSlug, "#write-review")} className="btn-ghost">
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
