import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useAdminQuestions } from "../../hooks/useAdminQuestions.js";
import QuestionRow from "../../components/admin/questions/QuestionRow.jsx";
import { AnswerModal, RejectQuestionModal } from "../../components/admin/questions/QuestionModals.jsx";

/**
 * AdminQuestions — /admin/questions (permission questions.manage:
 * GM, Support, Store).
 *
 * Tabs Pending / Published / Rejected / All. A question is public only
 * when it is Published with an answer (the database enforces that a
 * published question has one). Answering publishes it; the customer is
 * emailed once (notify-event webhook).
 */
export default function AdminQuestions() {
  const { status, setStatus, questions, counts, loading, error, answer, reject, toPending, remove } = useAdminQuestions("pending");
  const [answering, setAnswering] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [actionErr, setActionErr] = useState(null);

  async function run(id, fn) {
    setBusyId(id);
    setActionErr(null);
    const res = await fn();
    setBusyId(null);
    if (!res.ok) setActionErr(res.error);
    return res;
  }

  const handlePending = (q) => run(q.id, () => toPending(q.id));
  const handleDelete = (q) => {
    if (!window.confirm("Delete this question permanently? Cannot be undone.")) return;
    run(q.id, () => remove(q.id));
  };

  const TABS = [
    { id: "pending", label: "Pending", count: counts.pending },
    { id: "published", label: "Published", count: counts.published },
    { id: "rejected", label: "Rejected", count: counts.rejected },
    { id: "all", label: "All", count: counts.pending + counts.published + counts.rejected },
  ];

  return (
    <div className="adm-page">
      <header className="adm-page__head">
        <div>
          <h1>Questions</h1>
          <p>Answer customers' product questions. Answered questions appear on the product page as “NAVEN Team”.</p>
        </div>
      </header>

      <div className="revq-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={status === t.id}
                  className={"revq-tab" + (status === t.id ? " revq-tab--on" : "")} onClick={() => setStatus(t.id)}>
            {t.label}
            {t.count > 0 && <span className="revq-tab__count">{t.count}</span>}
          </button>
        ))}
      </div>

      {error && <div className="hb__err">Couldn't load questions: {error}</div>}
      {actionErr && <div className="hb__err">{actionErr}</div>}

      {loading && questions.length === 0 ? (
        <div className="hb__loading">Loading questions…</div>
      ) : questions.length === 0 ? (
        <div className="cat-empty">
          <HelpCircle size={40} strokeWidth={1.2} />
          <h2>
            {status === "pending" && "No questions waiting"}
            {status === "published" && "No published questions yet"}
            {status === "rejected" && "No rejected questions"}
            {status === "all" && "No questions yet"}
          </h2>
          <p>{status === "pending" ? "Nothing to answer right now. New questions will appear here." : "Questions customers ask on product pages show up here."}</p>
        </div>
      ) : (
        <ul className="revq-list">
          {questions.map((q) => (
            <QuestionRow key={q.id} question={q} busy={busyId === q.id}
                         onAnswer={(x) => { setActionErr(null); setAnswering(x); }}
                         onReject={(x) => { setActionErr(null); setRejecting(x); }}
                         onPending={handlePending} onDelete={handleDelete} />
          ))}
        </ul>
      )}

      {answering && (
        <AnswerModal question={answering} onClose={() => setAnswering(null)}
                     onSubmit={(text) => run(answering.id, () => answer(answering.id, text))} />
      )}
      {rejecting && (
        <RejectQuestionModal question={rejecting} onClose={() => setRejecting(null)}
                             onSubmit={(note) => run(rejecting.id, () => reject(rejecting.id, note))} />
      )}
    </div>
  );
}
