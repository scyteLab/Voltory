import { useCallback, useEffect, useRef, useState } from "react";
import {
  QUESTIONS_PAGE_SIZE, askQuestion, deleteQuestion, fetchMyQuestions, fetchProductQuestions, fetchQuestionCount,
} from "../lib/questionsClient.js";
import { useCustomerAuth } from "../context/AuthContext.jsx";

/**
 * useProductQuestions — the product page's Q&A:
 *
 *   count                  answered questions (public)
 *   questions, hasMore     newest first, 10 at a time; loadMore()
 *   search, setSearch      filters question + answer text (debounced)
 *   mine                   this customer's own questions about THIS
 *                          product that aren't public yet (pending /
 *                          not published); only they see these
 *   ask(), remove()
 */
export function useProductQuestions(productSku) {
  const { customer } = useCustomerAuth();
  const customerId = customer?.id || null;

  const [count, setCount] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [mine, setMine] = useState([]);
  const req = useRef(0);

  // Debounce typing in the search box.
  useEffect(() => {
    const t = setTimeout(() => setTerm(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!productSku) return undefined;
    let live = true;
    fetchQuestionCount(productSku).then((r) => { if (live) setCount(r.count); });
    return () => { live = false; };
  }, [productSku]);

  useEffect(() => {
    if (!productSku) return;
    const n = ++req.current;
    setLoading(true);
    fetchProductQuestions(productSku, { limit: QUESTIONS_PAGE_SIZE, offset: 0, search: term }).then((r) => {
      if (n !== req.current) return;
      setLoading(false);
      setQuestions(r.questions);
      setHasMore(r.hasMore);
      setError(r.ok ? null : r.error);
    });
  }, [productSku, term]);

  const loadMore = useCallback(async () => {
    const n = ++req.current;
    setLoading(true);
    const r = await fetchProductQuestions(productSku, { limit: QUESTIONS_PAGE_SIZE, offset: questions.length, search: term });
    if (n !== req.current) return;
    setLoading(false);
    if (!r.ok) { setError(r.error); return; }
    setQuestions((prev) => {
      const seen = new Set(prev.map((q) => q.id));
      return [...prev, ...r.questions.filter((q) => !seen.has(q.id))];
    });
    setHasMore(r.hasMore);
  }, [productSku, questions.length, term]);

  const refreshMine = useCallback(async () => {
    if (!customerId || !productSku) { setMine([]); return; }
    const r = await fetchMyQuestions();
    if (r.ok) setMine(r.questions.filter((q) => q.productSku === productSku && !(q.status === "published" && q.answer)));
  }, [customerId, productSku]);

  useEffect(() => { refreshMine(); }, [refreshMine]);

  const ask = useCallback(async (question) => {
    const res = await askQuestion({ sku: productSku, question });
    if (res.ok) setMine((prev) => [res.question, ...prev.filter((q) => q.id !== res.question.id)]);
    return res;
  }, [productSku]);

  const remove = useCallback(async (id) => {
    const res = await deleteQuestion(id);
    if (res.ok) setMine((prev) => prev.filter((q) => q.id !== id));
    else refreshMine();
    return res;
  }, [refreshMine]);

  return { count, questions, hasMore, loading, error, search, setSearch, term, loadMore, mine, ask, remove, signedIn: Boolean(customerId) };
}
