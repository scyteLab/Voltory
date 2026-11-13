/**
 * Review rules shared by the review form (browser) and the
 * customer-data function (server), so both sides agree. Pure: no
 * browser or Node APIs. The server is the one that enforces them.
 */

export const REVIEW_LIMITS = { titleMax: 120, bodyMin: 10, bodyMax: 2000 };

/** Label for each star value, index 0 = 1 star. */
export const RATING_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

export const REVIEW_ERROR_MESSAGES = {
  invalid_rating: "Please pick a rating from 1 to 5 stars.",
  invalid_title: "Please check the title.",
  title_too_long: `Title is too long (max ${REVIEW_LIMITS.titleMax} characters).`,
  invalid_body: "Please check your review text.",
  body_too_short: `Please write at least ${REVIEW_LIMITS.bodyMin} characters, or leave the comment empty.`,
  body_too_long: `Review is too long (max ${REVIEW_LIMITS.bodyMax} characters).`,
  invalid_sku: "We couldn't find that product.",
  unknown_product: "We couldn't find that product.",
  not_eligible: "Only customers who received this product can review it.",
  not_found: "We couldn't find your review.",
  rate_limited: "You've made a lot of changes. Please try again in a while.",
  unauthorized: "Please sign in again to continue.",
};

/** Trim, unify line breaks and drop control characters (keeps \n). */
export function cleanText(v) {
  return String(v)
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "")
    .trim();
}

/**
 * { rating, title?, body? } → { ok:true, value:{ rating, title|null, body|null } }
 *                            | { ok:false, error:<code> }
 */
export function validateReviewInput(input = {}) {
  const rating = input.rating;
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "invalid_rating" };

  let title = null;
  if (input.title != null) {
    if (typeof input.title !== "string") return { ok: false, error: "invalid_title" };
    title = cleanText(input.title).replace(/\n+/g, " ") || null;
    if (title && title.length > REVIEW_LIMITS.titleMax) return { ok: false, error: "title_too_long" };
  }

  let body = null;
  if (input.body != null) {
    if (typeof input.body !== "string") return { ok: false, error: "invalid_body" };
    body = cleanText(input.body) || null;
    if (body && body.length < REVIEW_LIMITS.bodyMin) return { ok: false, error: "body_too_short" };
    if (body && body.length > REVIEW_LIMITS.bodyMax) return { ok: false, error: "body_too_long" };
  }

  return { ok: true, value: { rating, title, body } };
}
