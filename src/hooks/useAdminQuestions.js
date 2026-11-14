import { useCallback, useEffect, useState } from "react";
import {
  answerQuestion, deleteQuestionAsAdmin, fetchQuestionStatusCounts, fetchQuestionsForAdmin,
  moveQuestionToPending, rejectQuestion,
} from "../lib/questionsAdmin.js";

/**
 * useAdminQuestions — the Admin → Questions queue for one status tab,
 * plus the per-status counts. After every action the row is updated
 * in place (or dropped when it left the tab) and the counts refetched.
 */
export function useAdminQuestions(initialStatus = "pending") {
  const [status, setStatus] = useState(initialStatus);
  const [questions, setQuestions] = useState([]);
  const [counts, setCounts] = useState({ pending: 0, published: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshCounts = useCallback(() => fetchQuestionStatusCounts().then((c) => c.ok && setCounts(c.counts)), []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [list] = await Promise.all([fetchQuestionsForAdmin({ status }), refreshCounts()]);
    setLoading(false);
    setQuestions(list.questions);
    setError(list.ok ? null : list.error);
  }, [status, refreshCounts]);

  useEffect(() => { refresh(); }, [refresh]);

  const apply = useCallback(async (promise) => {
    const res = await promise;
    if (!res.ok) return res;
    const q = res.question;
    setQuestions((prev) => (status === "all" || q.status === status
      ? prev.map((x) => (x.id === q.id ? q : x))
      : prev.filter((x) => x.id !== q.id)));
    refreshCounts();
    return res;
  }, [status, refreshCounts]);

  const answer = useCallback((id, text) => apply(answerQuestion(id, text)), [apply]);
  const reject = useCallback((id, note) => apply(rejectQuestion(id, note)), [apply]);
  const toPending = useCallback((id) => apply(moveQuestionToPending(id)), [apply]);
  const remove = useCallback(async (id) => {
    const res = await deleteQuestionAsAdmin(id);
    if (res.ok) { setQuestions((prev) => prev.filter((x) => x.id !== id)); refreshCounts(); }
    return res;
  }, [refreshCounts]);

  return { status, setStatus, questions, counts, loading, error, refresh, answer, reject, toPending, remove };
}
