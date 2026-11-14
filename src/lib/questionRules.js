/**
 * Product Q&A rules shared by the browser (ask form, admin answer box)
 * and the customer-data function (server), so both sides agree. Pure:
 * no browser or Node APIs. The server and the database enforce them.
 *
 * Lengths are counted in characters (code points), the same way
 * Postgres char_length() counts them, so an emoji counts as one.
 */
import { cleanText } from "./reviewRules.js";

export const QUESTION_LIMITS = { min: 10, max: 500, answerMax: 2000 };

export const QUESTION_STATUSES = ["pending", "published", "rejected"];

export const QUESTION_ERROR_MESSAGES = {
  invalid_question: "Please type your question.",
  question_too_short: `Please write at least ${QUESTION_LIMITS.min} characters.`,
  question_too_long: `Your question is too long (max ${QUESTION_LIMITS.max} characters).`,
  invalid_sku: "We couldn't find that product.",
  unknown_product: "We couldn't find that product.",
  invalid_id: "We couldn't find that question.",
  not_found: "We couldn't find that question.",
  not_deletable: "This question has already been answered or reviewed, so it can't be deleted.",
  rate_limited: "You've asked a lot of questions in the last hour. Please try again later.",
  unauthorized: "Please sign in again to continue.",
};

/** Number of characters as Postgres counts them. */
export const charCount = (s) => [...String(s ?? "")].length;

/** question → { ok:true, value } | { ok:false, error:<code> } */
export function validateQuestion(input) {
  if (typeof input !== "string") return { ok: false, error: "invalid_question" };
  const value = cleanText(input);
  const n = charCount(value);
  if (n === 0) return { ok: false, error: "invalid_question" };
  if (n < QUESTION_LIMITS.min) return { ok: false, error: "question_too_short" };
  if (n > QUESTION_LIMITS.max) return { ok: false, error: "question_too_long" };
  return { ok: true, value };
}

/** Staff answer → { ok:true, value } | { ok:false, error:<message> } */
export function validateAnswer(input) {
  const value = cleanText(String(input ?? ""));
  if (charCount(value) < 2) return { ok: false, error: "Please write an answer." };
  if (charCount(value) > QUESTION_LIMITS.answerMax) {
    return { ok: false, error: `The answer is too long (max ${QUESTION_LIMITS.answerMax} characters).` };
  }
  return { ok: true, value };
}

/** What the customer sees for each status (My Questions, product page). */
export function questionStatusLabel(q) {
  if (q.status === "published" && q.answer) return "Answered";
  if (q.status === "rejected") return "Not published";
  return "Waiting for answer";
}
