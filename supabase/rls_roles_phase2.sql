-- ============================================================
--  PHASE 2 — role-aware RLS  (REVIEW FIRST. DO NOT RUN YET.)
--
--  Prerequisite: supabase/admin_roles_update.sql has run.
--  Test on a staging copy first, with one account per role.
--
--  HOW IT WORKS
--  Every policy below is RESTRICTIVE and applies only to the
--  `authenticated` role (admins — customers never get a Supabase
--  Auth session). Restrictive policies are AND-ed with the existing
--  permissive ones, so this file can only NARROW what admins can
--  do. It never touches the `anon` policies the storefront relies on
--  (checkout, WhatsApp quotes, forms, reviews, order tracking), and
--  the Netlify functions use the service role, which bypasses RLS.
--
--  RLS works on rows, not columns. Where a role may change only
--  some columns (Store can't change prices, Support may only add
--  order notes), a BEFORE UPDATE trigger enforces it.
--
--  ROLLBACK: every policy is named admin_role_*; the block at the
--  very end (commented out) drops them all, plus the triggers.
--
--  Mirrors src/config/permissions.js — keep them in step.
--  Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 0. Helpers
-- ------------------------------------------------------------

-- The signed-in admin's role: 'gm' | 'store' | 'support', or null
-- (not an admin, or deactivated). SECURITY DEFINER so it can read
-- admin_roles whatever that table's own policies are; it only ever
-- returns the caller's own role (auth.uid()).
create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when r.role = 'staff' then 'store' else r.role end
  from public.admin_roles r
  where r.user_id = auth.uid()
    and r.deactivated_at is null
$$;

revoke all on function public.current_admin_role() from public;
-- anon too: the guard triggers below call it, and for anon it is
-- simply null.
grant execute on function public.current_admin_role() to anon, authenticated, service_role;

-- True when the caller has any of the given roles.
create or replace function public.admin_has_role(variadic roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_admin_role() = any(roles), false)
$$;

revoke all on function public.admin_has_role(text[]) from public;
grant execute on function public.admin_has_role(text[]) to anon, authenticated, service_role;

-- (Re)create one restrictive policy, only if the table exists.
-- Session-local helper; disappears when this script's session ends.
create or replace function pg_temp.admin_policy(
  tbl text, cmd text, using_expr text, check_expr text default null
) returns void
language plpgsql
as $$
declare
  pol text := format('admin_role_%s_%s', replace(tbl, '.', '_'), lower(cmd));
  clauses text := '';
begin
  if to_regclass(tbl) is null then
    raise notice 'skip %: table not found', tbl;
    return;
  end if;
  execute format('drop policy if exists %I on %s', pol, tbl);
  if cmd in ('SELECT', 'DELETE', 'UPDATE') then
    clauses := clauses || format(' using (%s)', using_expr);
  end if;
  if cmd in ('INSERT', 'UPDATE') then
    clauses := clauses || format(' with check (%s)', coalesce(check_expr, using_expr));
  end if;
  execute format('create policy %I on %s as restrictive for %s to authenticated%s', pol, tbl, cmd, clauses);
end;
$$;

-- Shorthands used below
--   any admin   : public.current_admin_role() is not null
--   gm + store  : public.admin_has_role('gm', 'store')


-- ------------------------------------------------------------
-- 1. Catalog — read: any admin. write: GM + Store.
--    Support can look products up but can't edit them.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'public.products', 'public.categories', 'public.brands',
    'public.attributes', 'public.attribute_values', 'public.category_attributes',
    'public.product_attribute_values', 'public.collections', 'public.collection_products',
    'public.site_sections', 'public.site_settings'
  ] loop
    perform pg_temp.admin_policy(t, 'SELECT', 'public.current_admin_role() is not null');
    perform pg_temp.admin_policy(t, 'INSERT', 'public.admin_has_role(''gm'', ''store'')');
    perform pg_temp.admin_policy(t, 'UPDATE', 'public.admin_has_role(''gm'', ''store'')');
    perform pg_temp.admin_policy(t, 'DELETE', 'public.admin_has_role(''gm'', ''store'')');
  end loop;
end;
$$;

-- Prices: only the GM changes price / was on an existing product.
-- Store's price edits go through the approvals table instead; the GM
-- Portal applies them with the GM's session. (New products may be
-- created with a price.)
create or replace function public.products_guard_price()
returns trigger
language plpgsql
as $$
begin
  if public.current_admin_role() = 'store'
     and (new.price is distinct from old.price or new.was is distinct from old.was) then
    raise exception 'Price changes need GM approval' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists products_guard_price on public.products;
create trigger products_guard_price
  before update on public.products
  for each row execute function public.products_guard_price();


-- ------------------------------------------------------------
-- 2. Offers — read: any admin. write: GM only.
--    (Store proposes offer changes as approvals.)
-- ------------------------------------------------------------
select pg_temp.admin_policy('public.product_offers', 'SELECT', 'public.current_admin_role() is not null');
select pg_temp.admin_policy('public.product_offers', 'INSERT', 'public.admin_has_role(''gm'')');
select pg_temp.admin_policy('public.product_offers', 'UPDATE', 'public.admin_has_role(''gm'')');
select pg_temp.admin_policy('public.product_offers', 'DELETE', 'public.admin_has_role(''gm'')');

-- Checkout discounts / thresholds (Marketing page): GM only.
select pg_temp.admin_policy('public.checkout_settings', 'SELECT', 'public.current_admin_role() is not null');
select pg_temp.admin_policy('public.checkout_settings', 'INSERT', 'public.admin_has_role(''gm'')');
select pg_temp.admin_policy('public.checkout_settings', 'UPDATE', 'public.admin_has_role(''gm'')');
select pg_temp.admin_policy('public.checkout_settings', 'DELETE', 'public.admin_has_role(''gm'')');


-- ------------------------------------------------------------
-- 3. Orders
--    read   : any admin
--    insert : GM + Store (converting a WhatsApp quote creates one)
--    update : any admin, narrowed by the trigger below
--    delete : GM; Store only to roll back a quote conversion whose
--             items failed (an item-less order under 10 minutes old)
-- ------------------------------------------------------------
select pg_temp.admin_policy('public.orders', 'SELECT', 'public.current_admin_role() is not null');
select pg_temp.admin_policy('public.orders', 'INSERT', 'public.admin_has_role(''gm'', ''store'')');
select pg_temp.admin_policy('public.orders', 'UPDATE', 'public.current_admin_role() is not null');
select pg_temp.admin_policy('public.orders', 'DELETE',
  'public.admin_has_role(''gm'') or (public.admin_has_role(''store'')'
  || ' and created_at > now() - interval ''10 minutes'''
  || ' and not exists (select 1 from public.order_items i where i.order_id = orders.id))');

-- Who may change what on an order:
--   gm      — anything (incl. cancel / refund)
--   store   — anything except moving it to cancelled or refunded
--   support — only admin_note
create or replace function public.orders_guard_role_fields()
returns trigger
language plpgsql
as $$
declare
  r text := public.current_admin_role();
begin
  if r is null or r = 'gm' then
    return new;   -- service role / postgres (r is null) and the GM
  end if;

  if r = 'support'
     and (to_jsonb(new) - 'admin_note' - 'updated_at') is distinct from (to_jsonb(old) - 'admin_note' - 'updated_at') then
    raise exception 'Support can only add notes to an order' using errcode = '42501';
  end if;

  if r = 'store'
     and new.status is distinct from old.status
     and new.status in ('cancelled', 'refunded') then
    raise exception 'Cancelling or refunding needs the GM' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_role_fields on public.orders;
create trigger orders_guard_role_fields
  before update on public.orders
  for each row execute function public.orders_guard_role_fields();

select pg_temp.admin_policy('public.order_items', 'SELECT', 'public.current_admin_role() is not null');
select pg_temp.admin_policy('public.order_items', 'INSERT', 'public.admin_has_role(''gm'', ''store'')');
select pg_temp.admin_policy('public.order_items', 'UPDATE', 'public.admin_has_role(''gm'', ''store'')');
select pg_temp.admin_policy('public.order_items', 'DELETE', 'public.admin_has_role(''gm'', ''store'')');


-- ------------------------------------------------------------
-- 4. WhatsApp quotes
--    read / update: any admin (Support: status + rep_notes only,
--    enforced by the trigger). items + delete: GM + Store.
-- ------------------------------------------------------------
select pg_temp.admin_policy('public.whatsapp_quotes', 'SELECT', 'public.current_admin_role() is not null');
select pg_temp.admin_policy('public.whatsapp_quotes', 'UPDATE', 'public.current_admin_role() is not null');
select pg_temp.admin_policy('public.whatsapp_quotes', 'DELETE', 'public.admin_has_role(''gm'', ''store'')');

create or replace function public.whatsapp_quotes_guard_role_fields()
returns trigger
language plpgsql
as $$
begin
  if public.current_admin_role() = 'support'
     and (to_jsonb(new) - 'status' - 'rep_notes' - 'updated_at')
         is distinct from (to_jsonb(old) - 'status' - 'rep_notes' - 'updated_at') then
    raise exception 'Support can only change a quote''s status and notes' using errcode = '42501';
  end if;
  if public.current_admin_role() = 'support' and new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    raise exception 'Converting a quote is for Store or the GM' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.whatsapp_quotes') is not null then
    drop trigger if exists whatsapp_quotes_guard_role_fields on public.whatsapp_quotes;
    create trigger whatsapp_quotes_guard_role_fields
      before update on public.whatsapp_quotes
      for each row execute function public.whatsapp_quotes_guard_role_fields();
  end if;
end;
$$;

select pg_temp.admin_policy('public.whatsapp_quote_items', 'SELECT', 'public.current_admin_role() is not null');
select pg_temp.admin_policy('public.whatsapp_quote_items', 'INSERT', 'public.admin_has_role(''gm'', ''store'')');
select pg_temp.admin_policy('public.whatsapp_quote_items', 'UPDATE', 'public.admin_has_role(''gm'', ''store'')');
select pg_temp.admin_policy('public.whatsapp_quote_items', 'DELETE', 'public.admin_has_role(''gm'', ''store'')');


-- ------------------------------------------------------------
-- 5. Customers — read: any admin. write: GM + Store (a quote
--    conversion may create / link a customer). Delete: GM.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['public.customers', 'public.customer_addresses'] loop
    perform pg_temp.admin_policy(t, 'SELECT', 'public.current_admin_role() is not null');
    perform pg_temp.admin_policy(t, 'INSERT', 'public.admin_has_role(''gm'', ''store'')');
    perform pg_temp.admin_policy(t, 'UPDATE', 'public.admin_has_role(''gm'', ''store'')');
    perform pg_temp.admin_policy(t, 'DELETE', 'public.admin_has_role(''gm'')');
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 6. Inbox, warranty, reviews — GM + Support manage them.
--    Warranty and reviews stay readable by Store (dashboard widgets
--    and the product page). Inbox tables are GM + Support only.
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['public.contact_messages', 'public.form_submissions', 'public.newsletter_subscribers'] loop
    perform pg_temp.admin_policy(t, 'SELECT', 'public.admin_has_role(''gm'', ''support'')');
    perform pg_temp.admin_policy(t, 'UPDATE', 'public.admin_has_role(''gm'', ''support'')');
    perform pg_temp.admin_policy(t, 'DELETE', 'public.admin_has_role(''gm'', ''support'')');
  end loop;

  foreach t in array array['public.warranty_claims', 'public.reviews'] loop
    perform pg_temp.admin_policy(t, 'SELECT', 'public.current_admin_role() is not null');
    perform pg_temp.admin_policy(t, 'UPDATE', 'public.admin_has_role(''gm'', ''support'')');
    perform pg_temp.admin_policy(t, 'DELETE', 'public.admin_has_role(''gm'', ''support'')');
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 7. Approvals — the GM Portal queue
--    read   : GM sees all; others see only what they filed
--    insert : any admin, only as themselves, only 'pending'
--    update : GM only, as themselves, never on their own proposal
--             (two-person rule, now enforced by the database)
--    delete : nobody (audit trail)
-- ------------------------------------------------------------
select pg_temp.admin_policy('public.approvals', 'SELECT',
  'public.admin_has_role(''gm'') or (public.current_admin_role() is not null and created_by = auth.uid())');
select pg_temp.admin_policy('public.approvals', 'INSERT',
  null, 'public.current_admin_role() is not null and created_by = auth.uid() and status = ''pending''');
select pg_temp.admin_policy('public.approvals', 'UPDATE',
  'public.admin_has_role(''gm'') and created_by <> auth.uid()',
  'public.admin_has_role(''gm'') and created_by <> auth.uid() and decided_by = auth.uid()');
select pg_temp.admin_policy('public.approvals', 'DELETE', 'false');


-- ------------------------------------------------------------
-- 8. admin_roles — read: your own row, or the GM reads all.
--    The only browser write left is the GM saving their own TOTP
--    secret (GM setup). Adding people, roles and deactivation go
--    through the admin-team function (service role).
-- ------------------------------------------------------------
select pg_temp.admin_policy('public.admin_roles', 'SELECT',
  'user_id = auth.uid() or public.admin_has_role(''gm'')');
select pg_temp.admin_policy('public.admin_roles', 'INSERT', null, 'false');
select pg_temp.admin_policy('public.admin_roles', 'UPDATE',
  'user_id = auth.uid() and public.admin_has_role(''gm'')');
select pg_temp.admin_policy('public.admin_roles', 'DELETE', 'false');

-- ...and that own-row update may only touch the TOTP columns.
create or replace function public.admin_roles_guard_self_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.user_id is distinct from old.user_id
     or new.deactivated_at is distinct from old.deactivated_at then
    raise exception 'Roles are changed on the Team page' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists admin_roles_guard_self_update on public.admin_roles;
create trigger admin_roles_guard_self_update
  before update on public.admin_roles
  for each row execute function public.admin_roles_guard_self_update();


-- ------------------------------------------------------------
-- 9. Image uploads (product-images bucket): GM + Store only.
-- ------------------------------------------------------------
select pg_temp.admin_policy('storage.objects', 'INSERT', null,
  'bucket_id <> ''product-images'' or public.admin_has_role(''gm'', ''store'')');
select pg_temp.admin_policy('storage.objects', 'UPDATE',
  'bucket_id <> ''product-images'' or public.admin_has_role(''gm'', ''store'')');
select pg_temp.admin_policy('storage.objects', 'DELETE',
  'bucket_id <> ''product-images'' or public.admin_has_role(''gm'', ''store'')');


-- ------------------------------------------------------------
-- 10. Check
-- ------------------------------------------------------------
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies where policyname like 'admin_role_%' order by 1, 2, 4;


-- ------------------------------------------------------------
-- ROLLBACK (run on its own if something breaks)
-- ------------------------------------------------------------
-- do $$
-- declare p record;
-- begin
--   for p in select schemaname, tablename, policyname from pg_policies where policyname like 'admin_role_%' loop
--     execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
--   end loop;
-- end $$;
-- drop trigger if exists products_guard_price on public.products;
-- drop trigger if exists orders_guard_role_fields on public.orders;
-- drop trigger if exists whatsapp_quotes_guard_role_fields on public.whatsapp_quotes;
-- drop trigger if exists admin_roles_guard_self_update on public.admin_roles;
