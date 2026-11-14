import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { HelpCircle, MessageCircle, Search, Trash2, X } from "lucide-react";
import { QUESTION_LIMITS, charCount, questionStatusLabel, validateQuestion } from "../../lib/questionRules.js";

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-NG", { dateStyle: "medium" }) : "");

/**
 * QuestionsSection — "Questions & Answers" on the product page.
 *
 * `qa` is the useProductQuestions() result. Only published + answered
 * questions are public. Any signed-in customer can ask; the question
 * stays private (listed here just for them) until our team answers.
 * Opening /product/<slug>#ask-question opens the form (sign-in return).
 *
 * No FAQPage / QAPage structured data on purpose: the text is on the
 * page for search engines, the markup is restricted for stores.
 */
export default function QuestionsSection({ productName, productSlug, waHref, qa }) {
  const location = useLocation();
  const [formOpen, setFormOpen] = useState(false);
  const [text, setText] = useState("");
  const [formErr, setFormErr] = useState(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const areaRef = useRef(null);

  useEffect(() => {
    if (location.hash !== "#ask-question") return;
    if (qa.signedIn) setFormOpen(true);
    document.getElementById("ask-question")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, qa.signedIn]);

  useEffect(() => { if (formOpen) areaRef.current?.focus(); }, [formOpen]);

  async function submit(e) {
    e.preventDefault();
    const checked = validateQuestion(text);
    if (!checked.ok) {
      setFormErr(checked.error === "question_too_long"
        ? `Your question is too long (max ${QUESTION_LIMITS.max} characters).`
        : `Please write at least ${QUESTION_LIMITS.min} characters.`);
      return;
    }
    setSending(true);
    const res = await qa.ask(checked.value);
    setSending(false);
    if (!res.ok) { setFormErr(res.error); return; }
    setText("");
    setFormOpen(false);
    setNotice("Thanks! We'll answer soon.");
  }

  async function remove(q) {
    if (!window.confirm("Delete your question?")) return;
    setBusyId(q.id);
    const res = await qa.remove(q.id);
    setBusyId(null);
    setNotice(res.ok ? "Your question was deleted." : res.error);
  }

  const n = charCount(text.trim());
  const returnTo = `/product/${productSlug}#ask-question`;
  const searching = qa.term !== "";

  return (
    <section className="qa" id="questions" aria-labelledby="questions-heading">
      <div className="section-head" style={{ marginTop: 40 }}>
        <h2 id="questions-heading">Questions &amp; Answers</h2>
      </div>
      {qa.count > 0 && (
        <p className="qa__count">{qa.count} answered question{qa.count === 1 ? "" : "s"} about this product</p>
      )}

      <div className="qa__bar" id="ask-question">
        {qa.count > 0 && (
          <label className="qa__search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={qa.search}
              onChange={(e) => qa.setSearch(e.target.value)}
              placeholder="Search questions and answers"
              aria-label="Search questions and answers"
              maxLength={80}
            />
            {qa.search && (
              <button type="button" className="qa__search-x" onClick={() => qa.setSearch("")} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </label>
        )}
        <div className="qa__actions">
          {!qa.signedIn ? (
            <Link to={`/login?return=${encodeURIComponent(returnTo)}`} className="btn-shop">
              <HelpCircle size={14} /> Sign in to ask a question
            </Link>
          ) : !formOpen && (
            <button type="button" className="btn-shop" onClick={() => { setNotice(null); setFormErr(null); setFormOpen(true); }}>
              <HelpCircle size={14} /> Ask a question
            </button>
          )}
          {waHref && (
            <a className="btn-ghost qa__wa" href={waHref} target="_blank" rel="noreferrer" title="For urgent questions">
              <MessageCircle size={14} /> Ask on WhatsApp
            </a>
          )}
        </div>
      </div>

      {notice && <div className="revs__notice" role="status">{notice}</div>}

      {formOpen && (
        <form className="qa__form" onSubmit={submit} noValidate>
          <label className="rev-form__lbl" htmlFor="qa-text">Your question about {productName}</label>
          <textarea
            id="qa-text"
            ref={areaRef}
            value={text}
            onChange={(e) => { setText(e.target.value); if (formErr) setFormErr(null); }}
            rows={4}
            maxLength={QUESTION_LIMITS.max + 50}
            placeholder="e.g. Does it come with a wall bracket? What is the power consumption?"
            aria-describedby="qa-count qa-note"
          />
          <div className="qa__formrow">
            <small id="qa-note" className="qa__note">Our team will answer soon. Your question appears once answered.</small>
            <small id="qa-count" className={"qa__counter" + (n > QUESTION_LIMITS.max ? " qa__counter--over" : "")} aria-live="polite">
              {n}/{QUESTION_LIMITS.max}
            </small>
          </div>
          {formErr && <div className="rev-form__err" role="alert">{formErr}</div>}
          <div className="rev-form__actions">
            <button type="button" className="btn-ghost" onClick={() => { setFormOpen(false); setFormErr(null); }}>Cancel</button>
            <button type="submit" className="btn-shop" disabled={sending}>{sending ? "Sending…" : "Submit question"}</button>
          </div>
        </form>
      )}

      {qa.mine.length > 0 && (
        <div className="qa__mine">
          <b>Your questions (only you can see these)</b>
          <ul>
            {qa.mine.map((q) => (
              <li key={q.id}>
                <p>{q.question}</p>
                <div className="qa__mine-foot">
                  <span className={`revs__status revs__status--${q.status === "rejected" ? "rejected" : "pending"}`}>
                    {questionStatusLabel(q)}
                  </span>
                  <small>Asked {fmtDate(q.createdAt)}</small>
                  {q.canDelete && (
                    <button type="button" className="btn-ghost btn-ghost--danger" onClick={() => remove(q)} disabled={busyId === q.id}>
                      <Trash2 size={13} /> Delete
                    </button>
                  )}
                </div>
                {q.status === "rejected" && q.adminNote && <p className="qa__mine-note"><b>Note from NAVEN:</b> {q.adminNote}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {qa.loading && qa.questions.length === 0 ? (
        <div className="revs__loading">Loading questions…</div>
      ) : qa.questions.length === 0 ? (
        <div className="revs__empty qa__empty">
          <HelpCircle size={32} strokeWidth={1.2} />
          <p>{searching ? `No answered questions match “${qa.term}”.` : "No questions yet. Be the first to ask."}</p>
        </div>
      ) : (
        <>
          <div className="qa__list">
            {qa.questions.map((q) => (
              <article key={q.id} className="qa-card">
                <div className="qa-card__row">
                  <span className="qa-card__tag" aria-label="Question">Q</span>
                  <div>
                    <p className="qa-card__q">{q.question}</p>
                    <small>Asked by {q.author} · {fmtDate(q.askedAt)}</small>
                  </div>
                </div>
                <div className="qa-card__row qa-card__row--a">
                  <span className="qa-card__tag qa-card__tag--a" aria-label="Answer">A</span>
                  <div>
                    <p className="qa-card__a">{q.answer}</p>
                    <small><b>NAVEN Team</b> · {fmtDate(q.answeredAt)}</small>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {qa.hasMore && (
            <div className="revs__more">
              <button type="button" className="btn-ghost" onClick={qa.loadMore} disabled={qa.loading}>
                {qa.loading ? "Loading…" : "Load more questions"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
