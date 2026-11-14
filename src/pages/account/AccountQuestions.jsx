import { Link } from "react-router-dom";
import { HelpCircle, Trash2 } from "lucide-react";
import { useCustomerQuestions } from "../../hooks/useCustomerQuestions.js";
import { questionStatusLabel } from "../../lib/questionRules.js";

const productUrl = (slug, hash = "") => (slug ? `/product/${slug}${hash}` : "/");
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "");
const badgeClass = (q) =>
  q.status === "published" && q.answer ? "revs__status myq__badge--published"
    : q.status === "rejected" ? "revs__status revs__status--rejected"
    : "revs__status revs__status--pending";

/**
 * AccountQuestions — /account/questions
 *
 * Every question the customer asked, all statuses:
 *   Waiting for answer · Answered (with our answer) · Not published (+ note)
 * Asking happens on the product page (#ask-question).
 * Data: customer-data "my-questions" (server-checked).
 */
export default function AccountQuestions() {
  const { questions, loading, error, remove } = useCustomerQuestions();

  async function handleDelete(q) {
    if (!window.confirm(`Delete your question about "${q.productName}"?`)) return;
    const res = await remove(q.id);
    if (!res.ok) window.alert(res.error);
  }

  return (
    <div className="ord-list">
      <header className="ord-list__head">
        <h1>My Questions</h1>
        <p>
          {loading
            ? "Loading…"
            : questions.length === 0
            ? "You haven't asked any questions yet."
            : `${questions.length} question${questions.length === 1 ? "" : "s"} asked.`}
        </p>
      </header>

      {error && <div className="myrev-err" role="alert">{error}</div>}

      {!loading && questions.length === 0 ? (
        <div className="ord-empty">
          <HelpCircle size={48} strokeWidth={1.1} />
          <h2>No questions yet</h2>
          <p>Not sure about a product? Ask on its page and our team will answer.</p>
          <Link to="/" className="btn-shop">Browse products</Link>
        </div>
      ) : questions.length > 0 && (
        <ul className="myq">
          {questions.map((q) => (
            <li key={q.id} className="myq__row">
              <Link to={productUrl(q.productSlug)} className="myq__prod">
                {q.productImage && <img src={q.productImage} alt="" />}
                <div>
                  <b>{q.productName}</b>
                  <small>Asked {fmtDate(q.createdAt)}</small>
                </div>
              </Link>

              <div className="myq__body">
                <p><span className={badgeClass(q)}>{questionStatusLabel(q)}</span></p>
                <p className="myq__q">{q.question}</p>
                {q.answer && (
                  <p className="myq__answer"><b>NAVEN Team</b> · {fmtDate(q.answeredAt)}<br />{q.answer}</p>
                )}
                {q.status === "rejected" && (
                  <p className="myq__note">
                    {q.adminNote ? <><b>Note from NAVEN:</b> {q.adminNote}</> : "This question wasn't published."}
                  </p>
                )}
              </div>

              <div className="myq__actions">
                {q.productSlug && (
                  <Link to={productUrl(q.productSlug, q.answer ? "#questions" : "")} className="btn-ghost">View product</Link>
                )}
                {q.canDelete && (
                  <button type="button" className="btn-ghost btn-ghost--danger" onClick={() => handleDelete(q)}>
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
