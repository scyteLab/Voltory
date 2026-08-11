# Voltory — RLS Lockdown Plan

**Status:** DRAFT — no SQL is to be run based on this document until the prerequisites in Section 3 are addressed.

**Purpose:** This document is the honest audit and design for locking down Row-Level Security on Voltory's Supabase tables. Right now every table has permissive `using (true)` policies that were shipped as "interim" — anyone with the browser's anon key can read every customer's orders, addresses, phone numbers, and reviews.

This is fine for building. It is **not** fine for accepting real customers.

---

## 1. What "locked down" actually means

For each table we need to answer four questions:

1. **Who can SELECT this row?** (Public? Only the row's owner? Only admins?)
2. **Who can INSERT this row?** (Anyone? Only signed-in customers? Only admins?)
3. **Who can UPDATE this row?** (Only the owner? Only admins?)
4. **Who can DELETE this row?** (Almost always: only admins, or nobody.)

Currently every answer is "anyone with the anon key" — which in a browser SPA means "anyone on the internet who visits your site." That includes people who never signed up, and it includes hostile actors.

---

## 2. The current honest state of the codebase

Some architectural facts that shape what's possible:

### 2.1 There is no real "customer login" via Supabase Auth

Customers "sign in" via phone number + a fake OTP (`1234`). This creates a row in a custom `customers` table but does **not** create a Supabase Auth user. That means `auth.uid()` is always `null` for customers, and any RLS policy of the form `auth.uid() = customer_id` **will refuse every customer request.**

**Implication:** the standard Supabase RLS pattern — customer signs in via Supabase Auth, RLS matches `auth.uid()` — does not work for Voltory as currently built.

### 2.2 Admin also does not authenticate through Supabase Auth

Admin access is currently a static role check in the SPA. There's no server-side gate. Anyone who visits `/admin/orders` and gets past the client-side role check can query Supabase with the same anon key a guest checkout uses.

**Implication:** we cannot write "admin-only" RLS policies against `auth.uid()` either. We need a real admin auth mechanism first.

### 2.3 Guest checkout writes to `customers`, `orders`, `order_items` without any auth

The flow: anonymous browser → clicks "Place Order" → SPA writes rows into `customers`, `orders`, `order_items`. Any RLS lockdown must preserve this ability, OR we change the flow (e.g. require sign-in before checkout, or route these writes through a serverless function that holds the service-role key).

### 2.4 `whatsapp_quotes` also gets anonymous writes

Same as guest checkout — the "Send Cart to WhatsApp" modal writes a quote row from an unauthenticated browser.

### 2.5 Reviews are authored by "signed-in" customers (see 2.1 — they're not really signed in)

A customer must have an order for that product to write a review. The write happens from the browser with the anon key.

### 2.6 Homepage builder, categories admin, brands admin, reviews moderation queue all use anon key

These are all admin-only surfaces from a UX perspective, but they all currently use the same anon key that guest browsers use.

---

## 3. Prerequisites — do these BEFORE running any lockdown SQL

**These are hard blockers. Every one must be resolved.**

### 3.1 Decide on a real admin auth story

Three viable options, each with real tradeoffs:

**Option A — Supabase Auth for admin users only.**
- Create Supabase Auth users for each admin (email + password, or magic link).
- Admin login page authenticates via `supabase.auth.signInWithPassword`.
- RLS policies for admin surfaces use `auth.jwt() ->> 'role' = 'admin'` or check membership in an `admin_users` table.
- Customer checkout still runs anonymous (see 3.2).
- **Pros:** clean, standard, no new infrastructure.
- **Cons:** admin login flow needs to be built. Not hard — maybe 3-4 files.

**Option B — Netlify serverless functions with the service-role key.**
- Every admin mutation goes through a Netlify function.
- Function verifies the caller is an admin (session cookie, JWT, whatever), then uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.
- SPA never talks to Supabase directly for admin surfaces.
- **Pros:** most flexible, doesn't require rewriting queries.
- **Cons:** every admin surface needs its own function endpoint. Significant work. Migration is invasive.

**Option C — Do nothing about admin auth; use IP allowlisting or basic auth via Netlify.**
- Netlify-level protection on `/admin/*` routes.
- SPA still uses anon key, but only staff can reach the admin pages.
- **Pros:** zero code changes, ships in an hour.
- **Cons:** the anon key can still be used by a hostile person who obtains it via a screenshot, browser extension, or shared computer. Doesn't actually protect the DB — just the UI. Fine as a defense-in-depth layer, insufficient as the only defense.

**Recommendation:** Option A. It's the standard pattern, has the cleanest code footprint, and matches what the codebase already almost supports.

### 3.2 Decide on the guest checkout write path

Two options:

**Option A — Keep guest writes to `customers`, `orders`, `order_items` from the browser.**
- These tables need INSERT policies that allow anon writes.
- To prevent hostile writes (bad actors creating fake customers, spam orders), we can require CAPTCHA, or accept the risk given ordering volume, or check for reasonable-looking data (server-side function with light validation).

**Option B — Route guest checkout through a serverless function.**
- Netlify function receives the cart + contact + address, does its own validation, writes to Supabase using service-role key.
- No anon writes to `customers` / `orders` needed.
- Migration is real work — Session 30 built the flow going the other direction.

**Recommendation:** Option A for now (anon INSERT allowed with minimal SELECT rights), Option B as a follow-up hardening later. Getting the SELECT lockdown in place is 80% of the win.

### 3.3 Create a staging Supabase project

Cloning the production project is a few clicks. Test every RLS change against staging first. Never paste RLS SQL directly into production the first time.

### 3.4 Have a rollback plan ready

Before every lockdown migration, save the current permissive policies as `<table>_rollback.sql` in the repo. If admin breaks after a deploy, one file to run and we're back to interim state.

### 3.5 Set up monitoring

At minimum, know:
- Are orders being created? (Simple: count of new orders per day)
- Are reviews being written? (Same)
- Any 401/403 errors in the browser console? (Sentry, LogRocket, or manual browser check)

Without at least one of these, RLS breakages will be invisible for days.

---

## 4. Table-by-table plan

Written for **after** Section 3 prereqs are done, assuming Option A for admin auth (Supabase Auth with admin users) and Option A for guest checkout (anon writes allowed).

Each entry describes the target state — the actual SQL will be written in the execution session.

### 4.1 `customers`

**Sensitivity:** HIGH. Contains phone numbers, emails, names of every customer.

- **SELECT:**
  - Admin: yes (any row)
  - Customer: only rows where `phone = <the phone in their session>` — but since we don't have Supabase Auth for customers, this requires a workaround (see Section 5).
  - Anon: **no**
- **INSERT:**
  - Anon: yes (guest checkout creates rows here). Constrained: only allow inserting with a valid phone number pattern, no admin fields set.
- **UPDATE:**
  - Admin: yes (any row)
  - Customer: only own row, and only certain columns (name, email — not `id`, not admin_notes if we add one).
- **DELETE:**
  - Admin only.

**Complication:** the customer's own read/update path currently uses phone-based match, not `auth.uid()`. Without real customer auth, we can't reliably restrict this. Two options:

1. **Accept that customers can't self-serve edit their profile until Supabase Auth for customers exists.** Admin edits on their behalf via WhatsApp.
2. **Build customer-facing Supabase Auth as part of this project.** Real work — probably its own session.

**Recommendation:** option 1 for now. Lock down SELECT to admin-only + accept that customer's "my account" page has to route through a serverless function that verifies their phone another way (SMS OTP, once Termii is figured out).

### 4.2 `orders`

**Sensitivity:** HIGH. Contains delivery addresses, purchase history, payment status.

- **SELECT:**
  - Admin: yes
  - Customer: only own orders — same auth complication as `customers`.
  - Anon: **no**
- **INSERT:**
  - Anon: yes (guest checkout). Constrained: only allow inserting with a valid customer_id/phone match, no admin fields set, no `status` other than the initial value.
- **UPDATE:**
  - Admin only (change status, add notes, etc.).
- **DELETE:**
  - Admin only.

**Same auth issue as 4.1.** Customer-facing "my orders" page currently uses phone match — this will need to route through a function that verifies the caller by session cookie / OTP.

### 4.3 `order_items`

- **SELECT:** admin, and customers who own the parent order. Same auth issue.
- **INSERT:** anon (guest checkout).
- **UPDATE / DELETE:** admin only.

### 4.4 `customer_addresses`

**Sensitivity:** MEDIUM-HIGH (physical addresses).

- **SELECT:** admin, and the customer who owns the row.
- **INSERT:** the customer (their own only).
- **UPDATE:** the customer (own rows only).
- **DELETE:** the customer (own rows) or admin.

**Same auth complication.** Currently every write says `customer_id = <phone-mapped id>`. Locking this down needs the same Auth-or-function pattern.

### 4.5 `reviews`

**Sensitivity:** LOW for SELECT (approved reviews are meant to be public), MEDIUM for writes.

- **SELECT:**
  - Public: only `status = 'approved'` rows.
  - Admin: any row.
  - Customer: own rows regardless of status.
- **INSERT:** the customer for their own review only.
- **UPDATE:** the customer (own only, resets to pending if edit), admin (any, including status changes).
- **DELETE:** the customer (own only) or admin.

**Best candidate for a first RLS test** because:
- It has a clean public/private split (approved vs the rest).
- Auth complication for the customer side is contained.
- If it breaks, only the reviews section is affected — checkout, admin, homepage all keep working.

### 4.6 `products`, `categories`, `brands`

**Sensitivity:** LOW for SELECT (public catalog), HIGH for writes (only admin should touch).

- **SELECT:** public (no restriction).
- **INSERT / UPDATE / DELETE:** admin only.

**Straightforward** — no customer-auth complication. Once admin auth is in place, these are one-line policies.

### 4.7 `whatsapp_quotes` and `whatsapp_quote_items`

- **SELECT:** admin only. Customers don't need to read these back (they got the WhatsApp message with the quote reference).
- **INSERT:** anon (send-cart flow). Constrained: sane data only.
- **UPDATE / DELETE:** admin only.

### 4.8 `warranty_claims`

Same pattern as orders — customer-owned, admin-managed. Same auth complication for customer self-serve.

### 4.9 `homepage_sections`, `site_settings`, `site_sections`

- **SELECT:** public (needed to render the storefront).
- **INSERT / UPDATE / DELETE:** admin only.

Straightforward once admin auth is in place.

### 4.10 `dashboard_kpis` view

Views inherit RLS from their base tables. Once base tables are locked, this view is naturally admin-only.

### 4.11 `customer_events` (future — behavioral tracking)

Not built yet. When it is:
- INSERT from anon browsers is fine (that's the whole point — tracking events).
- SELECT admin only.

---

## 5. The customer-auth-shaped hole

**This is the most important thing in this document.**

Every table that has a "customer can read their own row" requirement runs into the same wall: customers do not have Supabase Auth sessions. `auth.uid()` is null. Standard RLS patterns fail.

There are three ways to fix this. Each is a real project.

### 5.1 Build proper customer auth via Supabase Auth

- Customer signs up with phone number → email magic link → Supabase Auth user
- Or: phone-based OTP via Supabase Auth (requires real SMS provider — this is where Termii would live)
- RLS policies become the standard `auth.uid() = customer_id` pattern
- **Best long-term answer. Real work — probably 2-3 sessions to migrate cleanly.**

### 5.2 Route customer-facing reads through serverless functions

- `/api/my-orders`, `/api/my-addresses`, etc.
- Function verifies the caller via session cookie (which we set on OTP verification, once Termii is real)
- Function uses service-role key to fetch the right rows
- **Migration is significant.** Every customer-facing "my X" page needs its data path rewritten.

### 5.3 Accept that customer self-serve is admin-only for now

- Customer "my orders" / "my addresses" / "my reviews" pages become read-only shells that show "contact us on WhatsApp for updates"
- Admin edits everything
- **Regression from current UX.** Not ideal, but honest.

**Recommendation:** commit to 5.1 as the medium-term direction, use 5.3 as a short-term shim for launch, and gradually migrate as auth is built out.

---

## 6. Suggested execution order (when prereqs are done)

If Section 3 is fully addressed and 5.1 is chosen:

1. **Public catalog first** — `products`, `categories`, `brands`, `site_sections`, `site_settings`, `homepage_sections`. Public SELECT, admin-only writes. Low risk, high value.
2. **Reviews second** — the test case. Public SELECT for approved, admin for all, customer for own. First real customer-auth-shaped policy.
3. **whatsapp_quotes / items** — admin SELECT only, anon INSERT. Isolates the WhatsApp flow.
4. **customer_addresses** — customer + admin only.
5. **orders / order_items** — the high-stakes ones. Do last, after everything else has been proven.
6. **customers** — the highest stakes. Do LAST, and with a maintenance window / rollback ready.
7. **warranty_claims** — same tier as orders.

Each step: run in staging, verify end-to-end (guest checkout, customer login, admin dashboard, all admin pages), then promote to production.

---

## 7. What NOT to do

- **Do not use `create policy ... using (true)` and call it "locked down."** That's the current state and it's the problem.
- **Do not lock down all tables in one deploy.** Even if the SQL is perfect, verifying a working end-to-end flow requires exercising every user path. Do it incrementally.
- **Do not write `create policy ... using (auth.uid() = customer_id)` on customer tables until customer Supabase Auth is real.** It will lock every real customer out.
- **Do not rely on the anon key being "secret."** It ships to every browser. It is public. Every policy must assume anyone can call any query.
- **Do not forget the service-role key never touches the browser.** It's for serverless functions only.

---

## 8. Estimated timeline

Realistic, honest:

- Prereqs (Section 3): **2-3 sessions** for the admin auth work alone. Longer if we go with option 5.1 for customer auth.
- Staging setup and rollback prep: **half a session**.
- Executing the plan in Section 6: **2-3 sessions** if things go smoothly. Add half a session for each surprise.
- Total: **5-8 sessions** from the current state to genuinely locked down.

Anyone who tells you "we can just add RLS in one afternoon" is wrong. RLS added late in a project is always this much work.

---

## 9. What we do NOT ship as part of the initial launch

If you're launching before all of this is done, be honest about the risk:

- Anyone can enumerate every customer's phone numbers and emails.
- Anyone can enumerate every order and delivery address.
- Anyone can write fake reviews if they're patient enough to figure out the eligibility check.
- Anyone can write fake orders / quotes.

None of this is catastrophic if traffic is low and no one has motivation to attack. It becomes catastrophic when the site gets noticed. **This is why RLS lockdown is on the launch-blocker list even though the code "works" without it.**

---

## 10. Immediate next steps (not blocking the current backend-close plan)

While the prerequisites for real lockdown are being built, low-risk improvements we can make right now without RLS changes:

- **Add basic bot / spam protection on public POST endpoints.** Cloudflare Turnstile or hCaptcha on the checkout button.
- **Add reasonable server-side validation via a Postgres CHECK constraint or a database trigger** on tables like `reviews` — e.g. body length, no URLs, no repeated characters. Doesn't stop malicious actors but stops accidental garbage.
- **Rate limit the send-cart-to-whatsapp button client-side** so one user can't spam quotes.
- **Log every INSERT to `customers` and `orders` with the source IP** (via a trigger). If an attack happens, you have forensics.

These are cheap and can be shipped independently of the big RLS work.

---

## Document version

Written: August 2026. Update whenever architectural facts in Section 2 change.