import { useCallback, useEffect, useState } from "react";
import { deleteQuestion, fetchMyQuestions } from "../lib/questionsClient.js";
import { useCustomerAuth } from "../context/AuthContext.jsx";

/** useCustomerQuestions — the signed-in customer's own questions (My Account → My Questions). */
export function useCustomerQuestions() {
  const { customer } = useCustomerAuth();
  const customerId = customer?.id || null;
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!customerId) { setQuestions([]); setLoading(false); return; }
    setLoading(true);
    const res = await fetchMyQuestions();
    setLoading(false);
    setQuestions(res.questions);
    setError(res.ok ? null : res.error);
  }, [customerId]);

  useEffect(() => { refresh(); }, [refresh]);

  const remove = useCallback(async (id) => {
    const res = await deleteQuestion(id);
    refresh();
    return res;
  }, [refresh]);

  return { questions, loading, error, refresh, remove };
}
