# Customer auth & data lockdown plan

Status: **PLAN ONLY.** Nothing here has been built or run yet.
SQL drafts: `supabase/customer_lockdown.sql` (do not run yet) and
`supabase/customer_lockdown_rollback.sql`.

## 0. Where we are today

Everything below was confirmed on the live site with the public anon key
(read-only checks, no writes).

| Problem | Detail |
|---|---|
| Personal data is public | The anon key can `SELECT` `customers` (name, phone, email, and the `password_hash` column), `orders` (names, phones, delivery addresses, totals), `order_items`, and `customer_sessions`. |
| Login runs in the browser | `src/lib/customerAuth.js` fetches the customer row, including `password_hash`, and runs bcrypt in the browser. Sign-up writes the hash directly. The "5 attempts / 15 min" limit is a browser insert into `customer_otp_challenges`, so it can be skipped. |
| Sessions can be forged | The browser creates its own `customer_sessions` row (`token`, `customer_id`) with the anon key. Customer IDs are publicly readable, so anyone can probably create a session for any customer. Tokens are stored in plain text. |
| No server check of identity | No Netlify function verifies a customer. |
| Reviews are written from the browser | The purchase check, `order_id` and status are all chosen by the browser. |
| Checkout writes from the browser | `orders` and `order_items` are inserted with the anon key. `upsertFromCheckout` reads `customers` by phone with the anon key. |

Today's numbers: 10 customers, 0 stored password hashes, 13 orders (none
delivered), 0 visible sessions. So far few people are affected, which is
why this is the right moment to do it.

What must keep working throughout:
- checkout (guest and signed-in);
- Paystack (verify and webhook);
- switching to Pay on Delivery;
- WhatsApp quotes and converting a quote to an order;
- the order confirmation page, receipts, My Orders, guest order tracking
  and addresses;
- every admin page (Supabase Auth, role `authenticated`);
- the email notification webhooks.

Two facts make this safe to do in steps:
- **Customers never get a Supabase Auth session.** Every storefront
  request runs as `anon` and every admin request runs as `authenticated`,
  so the two can get different rules.
- **Everything else is already server-side.** The Netlify functions
  (Paystack, switch to Pay on Delivery, notifications, admin team) use
  the service role key and bypass RLS. Database webhooks run inside the
  database. None of them are affected by RLS changes.

---

## 1. `customer-auth` Netlify function

File: `netlify/functions/customer-auth.js`. It uses the service role
key, through the same REST helper style as `_shared/email.js`.

| Route (POST unless noted) | Does |
|---|---|
| `signup` `{phone, password, name, email?}` | Validates, then bcrypt-hashes on the server (cost 10). Creates or upgrades the customer row (see the "claiming a guest phone" risk in §8). Stores the hash in `customer_credentials`. Starts a session. |
| `signin` `{phone, password}` | Applies the rate limit, compares with bcrypt, starts a session. Returns the same error whether the phone is unknown or the password is wrong, and runs a dummy bcrypt compare for unknown phones so response time doesn't reveal which. |
| `signout` | Deletes the session row and clears the cookie. |
| `me` (GET) | Returns the customer (`id, name, phone, email, gender, dob, marketing_opt_in, created_at`), never the hash, or 401. |
| `change-password` `{currentPassword, newPassword}` | Checks the current password, writes the new hash, and **revokes every other session**. |
| `update-profile` `{name?, email?, gender?, dob?, marketing_opt_in?}` | Accepts only these fields. The phone can't change here; the ID and hash can never be changed. |

### Sessions
- **The token** is 32 random bytes (`crypto.randomBytes`), base64url.
- **The database** stores only `sha256(token)` in
  `customer_sessions.token_hash`, plus `expires_at` (30 days),
  `last_seen_at`, a short `user_agent` and `revoked_at`. A leaked
  database dump can't be replayed as a login.
- **Revoking:** sign-out deletes the row. A password change deletes all
  other rows. Admin can revoke later by deleting rows.
- **Expiry:** fixed 30 days from sign-in. `last_seen_at` is refreshed
  at most once an hour, for support and audit only.

### Cookie vs header: use a cookie
`Set-Cookie: naven_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`

- The site and its functions share one origin (`mynaven.com/.netlify/functions/*`),
  so the cookie is sent automatically, with no CORS setup.
- `HttpOnly` means JavaScript can never read the token. Today's
  localStorage token can be stolen by any script injected into the page
  (XSS).
- Set no `Domain` attribute, so the cookie belongs only to the exact
  site address. `Secure` still works on `http://localhost`.
- **CSRF:** `SameSite=Lax` already stops other sites from sending POST
  requests with the cookie. As a second guard, every request that
  changes something must be a `POST` with `Content-Type:
  application/json`, and its `Origin` header must equal the site origin
  (`URL` / `SITE_URL` env).
- **A header token is only better** when the API sits on a different
  domain, or when native apps call it. Neither applies; if a mobile app
  arrives later, the same function can also accept
  `Authorization: Bearer`.
- **Local development:** functions only run under `netlify dev`. Plain
  `vite` on port 5199 has no functions, so the account pages need
  `netlify dev` for testing.

### Rate limiting (server-side)
New table `auth_attempts(kind, key_hash, success, created_at)`. Only the
service role can use it.
- `key_hash` = an HMAC-SHA256 of the phone or IP, keyed with a new env
  variable `AUTH_PEPPER`, so the table holds no raw phones or IPs (NDPA).
- The IP comes from `x-nf-client-connection-ip` (set by Netlify).

| Action | Per phone | Per IP |
|---|---|---|
| Sign-in failures | 5 / 15 min | 20 / 15 min |
| Sign-up | 3 / hour | 5 / hour |
| Guest order lookup (track, receipt, confirmation) | 5 / 10 min per order ID | 10 / 10 min |
| Change password failures | 5 / 15 min per customer | — |

- **Response when blocked:** HTTP 429 with a friendly message and a
  `Retry-After` header.
- **Clean-up:** each call deletes rows older than 24 h (one cheap
  DELETE), so no scheduled job is needed.

---

## 2. Customer data function(s)

File: `netlify/functions/customer-data.js` (one function, routed by
`action`). Shared helpers:
- `_shared/customerSession.js`: reads the cookie, hashes it, looks up
  the session and returns the `customer` or null;
- `_shared/rateLimit.js`.

| Action | Who | Rule |
|---|---|---|
| `orders` (GET) | Signed-in | Orders where `customer_id = me.id` **or** `customer_phone` = my phone (both spellings), with items, newest first. See the "claiming a guest phone" risk in §8 for whether phone-matched orders should show. |
| `order` `{id, phone?}` | Anyone | Returned if (a) I'm signed in and it's my order, or (b) the ID **and** phone both match (rate-limited). Used by the order confirmation page, the receipt and tracking. |
| `track` `{id, phone}` | Guests | Same as (b) above, but returns only the tracking fields (status, dates, items, delivery area), not the full address. |
| `addresses` list / create / update / set-default / delete | Signed-in | Always filtered by `customer_id = me.id` on the server; the browser can never pass a `customer_id`. |
| `my-reviews` list / upsert / delete | Signed-in | **Phase 3.** The server checks for a **delivered** order containing that SKU, sets `order_id` and the status itself, and checks again on every edit. |

Answers shared by every action:
- **Shape:** the same order shape the pages already use
  (`toStorefrontShape`), so page changes stay small.
- **Errors:** "not found" and "phone doesn't match" return the same 404,
  so the answer never reveals that an order ID exists.

Order IDs are `VLT-YYYYMMDDHHmm-XXXX` (4 random base-36 characters,
about 1.7 million per minute). Together with the phone and the rate
limit, that is acceptable for guest lookups. A stronger option is
listed in §8.

---

## 3. Checkout

**Recommendation: keep the browser order insert for now, tightly
limited. Move order creation to a server function as a later, separate
phase (Phase 4).**

Why not now: order creation is woven into several flows that work
today and are fiddly to retest all at once:
- Paystack (`createPendingPaymentOrder` → `paystack-verify` /
  `paystack-webhook` reconciliation);
- the offline retry queue (`sweepUnsyncedOrders` replays orders kept in
  localStorage);
- the switch to Pay on Delivery;
- the gift lines.

Moving it in the same release as the auth change doubles the risk.

What changes now (Phase 1), so checkout no longer needs to READ
`customers`:
1. **A new database trigger `orders_link_customer`** (BEFORE INSERT on
   `orders`, SECURITY DEFINER):
   - It runs only for `anon` inserts. It ignores whatever `customer_id`
     the browser sent, finds or creates the customer by normalised
     phone (matching both `080…` and `+23480…`), fills a blank name or
     email, and sets `customer_id`. This is exactly what
     `upsertFromCheckout` does today, but inside the database.
   - It also stamps `inserted_at = now()`, which the browser can't set.
2. **Browser:** `placeOrder` stops calling `upsertFromCheckout` and
   sends `customer_id: null`. The function is then deleted.
3. **Anon insert rules (Step A of the SQL):**
   - `orders`: INSERT only, with no returned rows (the code already uses
     `.insert()` without `.select()`).
   - The new row must have status `pending_payment` or `confirmed`, a
     `created_at` within the last 2 days (for the offline queue), and
     no admin fields set.
   - The existing triggers still apply: payment guard, Pay on Delivery
     limit, notification guard.
   - `order_items`: INSERT only, and only into an order that the
     database itself saw inserted in the last 30 minutes. This uses a
     SECURITY DEFINER helper, because anon can no longer read `orders`
     to check.
4. **Admins** converting a WhatsApp quote insert as `authenticated` and
   aren't affected; the trigger skips them.

Risks that remain until Phase 4 (all exist today too):
- **Totals:** the browser still sends totals. The payment guard stops
  online orders being marked paid without Paystack, but a Pay on
  Delivery order could carry a wrong total. Staff confirm every Pay on
  Delivery order by phone.
- **Fake orders:** someone can create junk orders, or orders under
  another person's phone, which would then appear in that person's My
  Orders.
- **Extra items:** someone who knows a brand-new order ID can add items
  to it within 30 minutes.
- **Different phone at checkout:** a signed-in customer who checks out
  with a different phone gets the order linked to that phone's customer
  record. Phase 4 fixes this by taking `customer_id` from the session.

Phase 4 (later): a `place-order` function that re-prices from
`products`, links the customer from the session (or the phone for
guests), and inserts orders and items with the service role. Anon then
loses INSERT on both tables.

---

## 4. Every browser call that changes

"Function" below means the new Netlify functions. Admin files
(`src/pages/admin/*`, `src/hooks/useOrders.js`, `useCustomers.js`,
`useDashboardData.js`, `useReports.js`, `useWarranty.js`,
`approvalActions.js`, `dataExports.js`, `CommandPalette.jsx`,
`AdminReceipts*.jsx`, `whatsappQuotesAdmin.js`, `reviewsAdmin.js`) run as
`authenticated` and **don't change**. The new admin policies cover them.

| File | Call today (anon) | Replaced by | Phase |
|---|---|---|---|
| `src/lib/customerAuth.js` `findCustomerByPhone` | SELECT `customers` by phone, including `password_hash` | `customer-auth` signin/signup | 2 |
| ″ `signUp` | UPDATE/INSERT `customers` with the hash | `customer-auth` signup | 2 |
| ″ `signIn` rate limit | SELECT/INSERT/DELETE `customer_otp_challenges` | Server rate limit (`auth_attempts`) | 2 |
| ″ `upsertFromCheckout` | SELECT/UPDATE/INSERT `customers` | DB trigger `orders_link_customer`; function deleted | 1 |
| ″ `mintSession` | INSERT `customer_sessions` (plain token) | Server creates the session and the cookie | 2 |
| ″ `getCurrentCustomer` | SELECT `customer_sessions` + `customers` | `GET customer-auth/me` | 2 |
| ″ `signOutCurrent` | DELETE `customer_sessions` | `customer-auth` signout | 2 |
| ″ `updateProfile` | UPDATE `customers` | `customer-auth` update-profile | 2 |
| ″ `changePassword` | reads the hash, UPDATE `customers` | `customer-auth` change-password | 2 |
| `src/context/AuthContext.jsx` | calls the above | the same API, now backed by `fetch` | 2 |
| `src/lib/customerOrdersClient.js` `fetchCustomerOrders` | SELECT `orders` + `order_items` by `customer_id` / phone | `customer-data` orders. Phase 1: session token sent as a header; Phase 2: cookie. | 1 |
| ″ `fetchOrderById` (order confirmation) | SELECT `orders` by ID only | `customer-data` order `{id, phone}` (phone from the local order). If the order isn't on this device, the page asks for the phone. | 1 |
| ″ `fetchOrderByIdAndPhone` (receipt, track) | SELECT `orders` by ID + phone; browser rate limit in `order_tracking_attempts` | `customer-data` order / track (server rate limit) | 1 |
| `src/lib/orderTrackingClient.js` `trackOrder` | SELECT `orders`, `order_items`; `order_tracking_attempts` | Not imported anywhere (TrackOrder uses `customerOrdersClient`). **Delete it.** | 1 |
| `src/lib/ordersClient.js` `insertOrderToSupabase` | INSERT `orders`, `order_items` | Unchanged (INSERT stays, constrained) until Phase 4 | 4 |
| `src/context/StoreContext.jsx` `syncOrder` | `upsertFromCheckout` then insert | Stop calling `upsertFromCheckout`; send `customer_id: null` | 1 |
| `src/lib/customerAddressesClient.js` (all 6 functions) | SELECT/INSERT/UPDATE/DELETE `customer_addresses` | `customer-data` addresses | 2 |
| `src/lib/reviewsClient.js` `fetchProductReviews` | SELECT approved `reviews` joined with `customers(name)` | RPCs `product_reviews_public(sku, limit, offset, rating, sort)` and `product_review_summary(sku)`: approved only, display name (first name + initial), never `customer_id` | 3 (done) |
| ″ `checkReviewEligibility`, `upsertReview`, `deleteReview`, `fetchCustomerReviews` | `reviews`, `order_items`, `orders` | `customer-data` review-eligibility / review-upsert / review-delete / my-reviews (eligibility checked on the server) | 3 (done) |
| `src/lib/whatsappQuotesClient.js` | RPC `create_whatsapp_quote` (SECURITY INVOKER, `whatsapp_quotes` only) | Unchanged; it doesn't touch the locked tables | — |

Read-only users of `useCustomerAuth()`, which need no change once
`AuthContext` keeps its API:
- `Checkout.jsx`, `SendToWhatsappModal.jsx`, `Contact.jsx`,
  `Careers.jsx`;
- `AccountMenu.jsx`, `Header.jsx`, `MainNav.jsx`, `MobileBottomNav.jsx`;
- `AuthGuard.jsx`, the account pages, `ReviewsSection.jsx`.

Clean-up after Phase 2: remove `bcryptjs` from the browser bundle (it
moves to the functions).

---

## 5. RLS end state

| Table | anon | authenticated (admin) | service role |
|---|---|---|---|
| `customers` | nothing (from Step B) | admins: all | all |
| `customer_credentials` (new) | nothing | nothing | all |
| `customer_sessions` | nothing | nothing | all |
| `customer_addresses` | nothing | admins: all | all |
| `customer_otp_challenges` | nothing | nothing | all |
| `auth_attempts` (new) | nothing | nothing | all |
| `orders` | INSERT only, constrained (until Phase 4, then nothing) | admins: all | all |
| `order_items` | INSERT only, into a freshly inserted order (until Phase 4) | admins: all | all |
| `order_tracking_attempts` | nothing (replaced) | nothing | all |
| `reviews` | nothing direct; approved reviews through the RPC | admins: all | all |

- **Admins:** "admins" means `public.current_admin_role() is not null`,
  i.e. an active row in `admin_roles`. The finer per-role limits in
  `rls_roles_phase2.sql` are RESTRICTIVE policies named `admin_role_*`.
  This plan never drops them, so the two files combine safely in either
  order.
- **Two layers:** every step also revokes table **grants** from `anon`
  (not just policies), so a forgotten policy can't reopen access.
- **Rollback:** each step first copies the current policies and grants
  into `public.lockdown_backup`, so
  `customer_lockdown_rollback.sql` can restore exactly what existed
  before, step by step.

---

## 6. Existing customers

- **Sessions:** all current sessions are browser-minted plain-text
  tokens. Step B deletes them, so **everyone signs in again once**. The
  live check found 0 sessions visible, so almost nobody is affected.
  After Phase 2, the account pages see a 401 and redirect to sign-in.
- **Password hashes:** they are standard bcrypt (`$2a$10$…`), so the
  server's `bcryptjs` can check them unchanged. No password reset is
  needed. They move from `customers.password_hash` into the new
  `customer_credentials` table:
  1. During Phase 2, the server reads `customer_credentials` first and
     falls back to `customers.password_hash`, copying it across on the
     first successful sign-in.
  2. Step B copies any that remain and then empties
     `customers.password_hash`.
  3. Step D drops the column later.

  Today 0 customers have a hash, so this is mostly future-proofing.
- **Guest customers** (from checkout, no password) are unchanged and can
  sign up later. See the "claiming a guest phone" risk in §8.

---

## 7. Phases

Each phase can be deployed and rolled back on its own. **The order
matters:** the browser must stop reading a table *before* the anon
key's read access is removed.

### Phase 0: preparation (no behaviour change)
1. Run the inventory queries at the top of `customer_lockdown.sql`
   (read-only) and paste the results into this doc. They show today's
   policies, grants and triggers on the target tables.
2. Run **Step 0** of `customer_lockdown.sql`. It only adds things:
   - the `lockdown_backup` table;
   - the `current_admin_role()` / `is_admin()` helpers;
   - the `customer_credentials` and `auth_attempts` tables;
   - new columns on `customer_sessions` and `orders.inserted_at`;
   - the phone normaliser;
   - the `orders_link_customer` trigger;
   - the `order_accepts_items()` helper.
3. Add Netlify env `AUTH_PEPPER` (a long random string).

**Test:**
- Place a Pay on Delivery order and a card order (Paystack test mode).
  Both appear in admin with `customer_id` set.
- A repeat order with the same phone reuses the same customer row.
- Convert a WhatsApp quote to an order in admin.
- Notification emails still arrive.

**Rollback:** `drop trigger orders_link_customer on public.orders;`
Everything else in Step 0 is additive and harmless.

### Phase 1: orders reads move to the server (closes the biggest leak early)
- **Ship:**
  - `customer-data` with `orders`, `order`, `track`;
  - `_shared/rateLimit.js`;
  - for `orders` in this phase, the session is the **existing**
    localStorage token sent as the `X-Customer-Session` header and
    checked against `customer_sessions.token`.
- **Browser:**
  - change `customerOrdersClient.js` (3 functions) and
    `OrderConfirmation.jsx` (phone for the remote lookup);
  - remove the `upsertFromCheckout` call in `StoreContext`;
  - delete `orderTrackingClient.js`.
- **Then** run **Step A**: anon loses SELECT, UPDATE and DELETE on
  `orders`, `order_items` and `order_tracking_attempts`, and keeps the
  constrained INSERT.

**Test after deploy, before Step A:**
- Every flow below works, while the old direct reads still exist as a
  safety net.

**Test after Step A:**
- Read-only anon checks: `orders` and `order_items` return 0 rows or a
  permission error.
- Guest checkout works (Pay on Delivery and card), and so does the
  offline retry: place an order with the network blocked, then
  reconnect.
- Paystack verify works, and the webhook marks the order paid.
- Switching to Pay on Delivery works.
- The order confirmation page loads and refreshes its status.
- Receipt with `?phone=` works, and a wrong phone gives "not found".
- Track Order works; the 11th wrong guess within 10 minutes is blocked.
- My Orders works for a signed-in customer.
- In admin, these all work: orders list and detail, status change,
  internal notes, receipts, dashboard, reports, exports and quote
  conversion.

**Rollback:**
- Run "ROLLBACK STEP A" in `customer_lockdown_rollback.sql`. This
  restores the old policies and grants.
- Redeploy the previous site build if needed. The new functions can
  stay.

### Phase 2: customer auth moves to the server
- **Ship:**
  - `customer-auth`, the cookie, `_shared/customerSession.js`;
  - `customer-data` addresses;
  - the `orders` action switches to the cookie, keeping the header as a
    fallback until Step B.
- **Browser:**
  - rewrite `customerAuth.js` as thin `fetch` calls;
  - `AuthContext` keeps the same API;
  - point `customerAddressesClient.js` at the function;
  - remove `bcryptjs` from the browser.
- **Then** run **Step B**:
  - copy the remaining hashes into `customer_credentials` and empty
    `customers.password_hash`;
  - delete the old sessions (everyone signs in again);
  - anon loses all access to `customers`, `customer_sessions`,
    `customer_addresses` and `customer_otp_challenges`;
  - admin policies are added.

**Test:**
- Sign-up (new phone), sign-up on a phone that has checked out as a
  guest, sign-in, wrong password (generic error), lockout after 5 wrong
  attempts (and per IP after 20), sign-out, then the account pages
  redirect.
- Sign in on two devices, change the password on one: the other device
  is signed out.
- Profile update. Addresses: add, edit, set default, delete.
- My Orders.
- Checkout while signed in pre-fills the details.
- Read-only anon checks: `customers`, `customer_sessions` and
  `customer_addresses` return nothing.
- In the browser DevTools, the cookie shows as HttpOnly and
  `document.cookie` doesn't contain it.
- In admin, the Customers list and detail work.

**Rollback:**
- Run "ROLLBACK STEP B", which also restores `customers.password_hash`
  from `customer_credentials`.
- Redeploy the previous site build.
- Deleted old sessions aren't restored; customers simply sign in again.

### Phase 3: reviews
- **Ship:**
  - `customer-data` my-reviews (eligibility = a **delivered** order for
    that SKU with this customer; server sets `order_id` and status);
  - **Step C**, which adds the RPC `product_reviews_public` and removes
    every direct anon right on `reviews`.

  This is the foundation for the Jumia-style reviews upgrade.

  **Built (Jumia-style):**
  - `customer-data` actions `review-eligibility`, `review-upsert`,
    `review-delete` and `my-reviews` (`netlify/functions/_shared/reviewActions.js`).
    Writes are limited to 10 per hour per customer.
  - Every new review and every edit is saved as `pending`. The
    `reviews_recompute` trigger counts **approved** reviews only.
  - The `notify-event` webhook on `reviews` (INSERT + UPDATE) emails
    support@ and business@ when a review needs moderating.

**Test:**
- A customer with a delivered order can review it; one without can't.
- The product page lists only approved reviews, with no `customer_id`
  in the response.
- My Reviews works, and so does admin moderation.
- The rating and count on products update, if the trigger exists.

**Rollback:** "ROLLBACK STEP C" plus the previous site build.

### Phase 4 (later): server-side checkout
- **Ship:** a `place-order` function that re-prices from `products`,
  takes `customer_id` from the session, and writes with the service
  role.
- **Then:** anon loses INSERT on `orders` and `order_items` (Step E,
  drafted separately when we get there).

**Test:** the full checkout matrix again: Pay on Delivery, card,
transfer, abandoned payment then switch to Pay on Delivery, offline
retry, gifts.

### Step D (clean-up, a few weeks after Step B)
Drop `customers.password_hash`, `customer_sessions.token` and the
unused `order_tracking_attempts` table.

---

## 8. Risks and decisions

| Risk | Mitigation |
|---|---|
| **Claiming a guest phone (needs your decision).** Without SMS verification, anyone who knows your phone number can sign up with it and then see your past guest orders and addresses in My Orders, because orders are linked by phone. This is true today as well. | Options: **(a)** require an SMS code at sign-up (`send-otp-sms` and Termii already exist; recommended); **(b)** until then, My Orders shows only orders placed while signed in to that account, and guest orders stay reachable through Track Order (ID + phone). Recommend (b) in Phase 2 and (a) soon after. |
| A step runs before its browser code is live, or the reverse | Strict order: deploy the code, test, then run the SQL step. Each step has an exact rollback. |
| Old browser tabs running the previous JavaScript after a deploy | They fail softly (empty My Orders, sign-in error) until refreshed. Deploy at a quiet hour. |
| Unknown existing policies (the original DDL isn't in the repo) | Phase 0 inventory, plus the automatic backup inside every step. The steps drop all non-`admin_role_*` policies on the target tables and create known ones. |
| Admin loses access because existing policies were `to public` | Each step creates the admin policies **in the same transaction** that drops the old ones. Test admin pages straight after each step. |
| `admin_roles.deactivated_at` missing (`admin_roles_update.sql` not run) | Step 0 stops with a clear message. |
| Rate-limit table growth | Rows older than 24 h are deleted on each call. |
| Functions only run under `netlify dev` locally | Document in the README; test the account pages with `netlify dev`. |
| bcrypt CPU in functions | Cost 10 is about 100 ms; fine for Netlify's limits. |
| Order IDs are only moderately random | ID + phone + rate limit for now. Optional: a random `view_key` per order kept on the customer's device, with its hash stored on the order, which then replaces the phone for confirmation links. |

**Live checks after every phase:**
- one Pay on Delivery order;
- one Paystack test payment, plus the webhook;
- confirmation and receipt pages;
- Track Order;
- My Orders;
- the notification email;
- admin orders and customers;
- the anon read-only probe (`scratchpad` script style: GET each table
  with the anon key and expect 0 rows or 401/403).
