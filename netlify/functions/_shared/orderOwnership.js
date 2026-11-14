/**
 * THE order-ownership rule for signed-in features (one place; used by
 * customer-data's My Orders, single-order access by session, review
 * eligibility and "waiting for your review").
 *
 *   An order belongs to the signed-in customer when
 *     orders.customer_id = me
 *     AND coalesce(orders.inserted_at, orders.created_at) >= my claimed_at
 *
 * claimed_at = when this phone was claimed by an account
 * (customer_credentials.claimed_at): the sign-up time for new
 * accounts, the customer's created_at for accounts that existed before
 * Phase 2. Orders matched only by phone no longer count, and guest
 * orders placed before the claim stay reachable only through the
 * guest lookup (order ID + phone), which is unchanged.
 *
 * Without SMS verification anyone could sign up with someone else's
 * phone number; this keeps that person's earlier guest orders hidden.
 *
 * `owner` = { customerId, claimedAt } from _shared/customerSession.js.
 * claimedAt null → the customer owns no orders (fail closed).
 */
import { enc } from "./serviceDb.js";

const time = (v) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : NaN;
};

/** The order's own timestamp: inserted_at (database clock, Step 0), else created_at. */
export const orderTime = (row) => time(row?.inserted_at || row?.created_at);

/** JS check for one order row. */
export function ownsOrder(row, owner) {
  if (!row || !owner?.customerId || !owner.claimedAt) return false;
  if (row.customer_id !== owner.customerId) return false;
  const t = orderTime(row);
  return Number.isFinite(t) && t >= time(owner.claimedAt);
}

/**
 * PostgREST filter for the same rule, e.g.
 *   customer_id=eq.<id>&or=(inserted_at.gte."<T>",and(inserted_at.is.null,created_at.gte."<T>"))
 * null when the owner can own nothing (caller returns an empty list).
 */
export function ownedOrdersFilter(owner) {
  if (!owner?.customerId || !owner.claimedAt) return null;
  const t = `"${new Date(owner.claimedAt).toISOString()}"`;   // quoted: safe inside or()/and()
  return `customer_id=eq.${enc(owner.customerId)}` +
    `&or=${enc(`(inserted_at.gte.${t},and(inserted_at.is.null,created_at.gte.${t}))`)}`;
}

/** Filter for this customer's orders placed BEFORE the claim (count only, for the notice). */
export function earlierOrdersFilter(owner, phones = []) {
  if (!owner?.customerId || !owner.claimedAt) return null;
  const t = `"${new Date(owner.claimedAt).toISOString()}"`;   // quoted: safe inside or()/and()
  const who = [`customer_id.eq.${owner.customerId}`];
  if (phones.length) who.push(`customer_phone.in.(${phones.map((p) => `"${p}"`).join(",")})`);
  return `or=${enc(`(${who.join(",")})`)}` +
    `&and=${enc(`(or(inserted_at.lt.${t},and(inserted_at.is.null,created_at.lt.${t})))`)}`;
}
