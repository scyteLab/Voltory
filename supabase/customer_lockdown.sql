-- ============================================================
--  CUSTOMER DATA LOCKDOWN  (DRAFT. DO NOT RUN YET.)
--
--  Plan: docs/CUSTOMER_AUTH_LOCKDOWN_PLAN.md
--  Rollback: supabase/customer_lockdown_rollback.sql
--
--  This file is split into steps. Run ONE step at a time, and only
--  after the site code for that phase is live and tested:
--
--    INVENTORY  read-only; run first, paste the output into the plan
--    STEP 0     additive only (tables, columns, helpers, checkout
--               trigger). Safe before any code change.
--    STEP A     Phase 1: anon loses SELECT/UPDATE/DELETE on orders,
--               order_items, order_tracking_attempts. Constrained
--               INSERT stays for checkout.
--    STEP B     Phase 2: anon loses everything on customers,
--               customer_sessions, customer_addresses,
--               customer_otp_challenges. Hashes move to
--               customer_credentials; old sessions are deleted.
--    STEP C     Phase 3: reviews. Public reads only through
--               product_reviews_public() / product_review_summary();
--               no direct anon access; ratings = approved only.
--    STEP D     Clean-up, weeks later (commented out).
--
--  Every step snapshots the current policies and grants of its
--  tables into public.lockdown_backup BEFORE changing anything, so
--  the rollback file can restore exactly what was there. A snapshot
--  is taken only once per step: re-running a step never overwrites
--  the original snapshot.
--
--  Admin access: every step that drops policies re-creates admin
--  policies (role "authenticated" + an active admin_roles row) in the
--  SAME transaction. RESTRICTIVE policies named admin_role_* (from
--  rls_roles_phase2.sql) are never dropped.
--
--  Service role (Netlify functions) bypasses RLS and is unaffected.
-- ============================================================


-- ============================================================
--  INVENTORY (read-only)
-- ============================================================
/*
select tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
 where schemaname = 'public'
   and tablename in ('customers','customer_sessions','customer_addresses','customer_otp_challenges',
                     'orders','order_items','order_tracking_attempts','reviews')
 order by tablename, policyname;

select c.relname as table_name, r.rolname as grantee,
       string_agg(a.privilege_type, ', ' order by a.privilege_type) as privileges
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(c.relacl) a
  join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public'
   and c.relname in ('customers','customer_sessions','customer_addresses','customer_otp_challenges',
                     'orders','order_items','order_tracking_attempts','reviews')
   and r.rolname in ('anon','authenticated')
 group by 1, 2 order by 1, 2;

select table_name, column_name, data_type, is_nullable, column_default
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('customers','customer_sessions','customer_addresses','customer_otp_challenges',
                     'order_tracking_attempts','reviews')
 order by table_name, ordinal_position;

select tgrelid::regclass as table_name, tgname, pg_get_triggerdef(oid)
  from pg_trigger
 where not tgisinternal
   and tgrelid::regclass::text in ('customers','orders','order_items','reviews','public.customers',
                                   'public.orders','public.order_items','public.reviews');

select (select count(*) from public.customers)                                as customers,
       (select count(*) from public.customers where password_hash is not null) as with_password,
       (select count(*) from public.customer_sessions)                        as sessions,
       (select count(*) from public.reviews)                                  as reviews;
*/


-- ============================================================
--  STEP 0 — additive only (run any time; no access changes)
-- ============================================================
begin;

-- 0.1 Precondition: admin_roles_update.sql must have run.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'admin_roles' and column_name = 'deactivated_at'
  ) then
    raise exception 'Run supabase/admin_roles_update.sql first (admin_roles.deactivated_at is missing).';
  end if;
end;
$$;

-- 0.2 Admin helpers (same definition as rls_roles_phase2.sql, so the
--     two files can run in either order).
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
grant execute on function public.current_admin_role() to anon, authenticated, service_role;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_admin_role() is not null
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- 0.3 Backup table + snapshot / reset helpers (SQL Editor use only).
create table if not exists public.lockdown_backup (
  id          bigint generated always as identity primary key,
  step        text not null,
  taken_at    timestamptz not null default now(),
  kind        text not null check (kind in ('table', 'policy', 'grant')),
  tablename   text not null,
  policyname  text,
  permissive  text,
  roles       text[],
  cmd         text,
  qual        text,
  with_check  text,
  grantee     text,
  privilege   text
);
alter table public.lockdown_backup enable row level security;
revoke all on public.lockdown_backup from anon, authenticated;

create or replace function public.lockdown_snapshot(p_step text, p_tables text[])
returns void
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.lockdown_backup where step = p_step) then
    raise notice 'Snapshot for step % already exists; keeping the original.', p_step;
    return;
  end if;

  insert into public.lockdown_backup (step, kind, tablename)
  select p_step, 'table', t from unnest(p_tables) t
   where to_regclass('public.' || t) is not null;

  insert into public.lockdown_backup (step, kind, tablename, policyname, permissive, roles, cmd, qual, with_check)
  select p_step, 'policy', p.tablename, p.policyname, p.permissive, p.roles::text[], p.cmd, p.qual, p.with_check
    from pg_policies p
   where p.schemaname = 'public' and p.tablename = any(p_tables);

  insert into public.lockdown_backup (step, kind, tablename, grantee, privilege)
  select p_step, 'grant', c.relname, r.rolname, a.privilege_type
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    join pg_roles r on r.oid = a.grantee
   where n.nspname = 'public' and c.relname = any(p_tables)
     and r.rolname in ('anon', 'authenticated');
end;
$$;

-- Drops every policy on the tables EXCEPT the phase-2 admin_role_* ones.
create or replace function public.lockdown_drop_policies(p_tables text[])
returns void
language plpgsql
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public' and tablename = any(p_tables)
       and policyname not like 'admin\_role\_%'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

revoke all on function public.lockdown_snapshot(text, text[]) from public, anon, authenticated;
revoke all on function public.lockdown_drop_policies(text[]) from public, anon, authenticated;

-- 0.4 Password hashes get their own server-only table. The key type
--     copies customers.id, whatever it is (uuid expected).
do $$
declare
  id_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into id_type
    from pg_attribute a
   where a.attrelid = 'public.customers'::regclass and a.attname = 'id';
  execute format(
    'create table if not exists public.customer_credentials (
       customer_id   %s primary key references public.customers(id) on delete cascade,
       password_hash text not null,
       updated_at    timestamptz not null default now()
     )', id_type);
end;
$$;
alter table public.customer_credentials enable row level security;
revoke all on public.customer_credentials from anon, authenticated;

-- 0.5 Sessions: hashed tokens, revocation, audit columns.
--     Live shape (inventory 2026-11): token text NOT NULL (the primary
--     key), customer_id, created_at, last_seen_at, expires_at,
--     user_agent; no id column. New-style sessions store only
--     token_hash, so token must become nullable, which a primary key
--     column can't be. So: add an id, move the primary key to it, keep
--     token unique for old-style rows (until Step B deletes them), and
--     only then drop NOT NULL on token. Every part checks the current
--     state first, so re-running is a no-op.
alter table public.customer_sessions add column if not exists token_hash   text;
alter table public.customer_sessions add column if not exists last_seen_at timestamptz;
alter table public.customer_sessions add column if not exists user_agent   text;
alter table public.customer_sessions add column if not exists revoked_at   timestamptz;
create unique index if not exists customer_sessions_token_hash_key
  on public.customer_sessions (token_hash) where token_hash is not null;

do $$
declare
  v_pk_name text;
  v_pk_cols text[];
begin
  -- 1. id column (existing rows get a value from the default).
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'customer_sessions'
                    and column_name = 'id') then
    alter table public.customer_sessions
      add column id uuid not null default gen_random_uuid();
  end if;

  -- 2. Current primary key, whatever it is called.
  select c.conname, array_agg(a.attname::text order by a.attnum)
    into v_pk_name, v_pk_cols
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
   where c.conrelid = 'public.customer_sessions'::regclass and c.contype = 'p'
   group by c.conname;

  -- 3. A primary key that includes token is replaced by one on id.
  --    (Fails loudly if a foreign key elsewhere references it; none
  --    is expected.)
  if v_pk_name is not null and 'token' = any (v_pk_cols) then
    execute format('alter table public.customer_sessions drop constraint %I', v_pk_name);
    v_pk_name := null;
  end if;
  if v_pk_name is null then
    alter table public.customer_sessions
      add constraint customer_sessions_pkey primary key (id);
  end if;

  -- 4. Old-style (plain token) sessions stay unique until Step B.
  execute 'create unique index if not exists customer_sessions_token_legacy_key
             on public.customer_sessions (token) where token is not null';

  -- 5. Now token can be nullable.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'customer_sessions'
                and column_name = 'token' and is_nullable = 'NO') then
    alter table public.customer_sessions alter column token drop not null;
  end if;
end;
$$;

-- 0.6 Server-side rate limiting (keys are HMACs, never raw phone/IP).
create table if not exists public.auth_attempts (
  id         bigint generated always as identity primary key,
  kind       text not null,
  key_hash   text not null,
  success    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists auth_attempts_lookup
  on public.auth_attempts (kind, key_hash, created_at desc);
alter table public.auth_attempts enable row level security;
revoke all on public.auth_attempts from anon, authenticated;

-- 0.7 Phone normaliser, same rules as src/utils/phone.js
--     (national number = 10 digits starting 70/71/80/81/90/91).
--     Returns "08012345678" or null.
create or replace function public.normalise_ng_phone(p text)
returns text
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
  n text;
begin
  if d like '00%' then d := substr(d, 3); end if;
  if d like '234%' then
    n := substr(d, 4);
    if length(n) = 11 and n like '0%' then n := substr(n, 2); end if;
  elsif d like '0%' then
    n := substr(d, 2);
  else
    n := d;
  end if;
  if n ~ '^[789][01][0-9]{8}$' then
    return '0' || n;
  end if;
  return null;
end;
$$;

-- 0.8 Checkout links the customer in the database, so the browser
--     never needs to READ customers. Replaces upsertFromCheckout().
--     Only anon inserts are rewritten; admin (quote conversion) and
--     service-role inserts keep their customer_id.
alter table public.orders add column if not exists inserted_at timestamptz;

create or replace function public.orders_link_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_id    public.customers.id%type;
  v_name  text := nullif(trim(coalesce(new.customer_name, '')), '');
  v_email text := nullif(lower(trim(coalesce(new.customer_email, ''))), '');
begin
  -- Database clock, not the browser's: order_accepts_items() relies on it.
  new.inserted_at := now();

  if auth.role() is distinct from 'anon' then
    return new;
  end if;

  v_phone := public.normalise_ng_phone(new.customer_phone);
  if v_phone is null then
    new.customer_id := null;
    return new;
  end if;

  -- Same choice as the old findCustomerByPhone(): both spellings,
  -- an account with a password wins, then the oldest row.
  select c.id into v_id
    from public.customers c
   where c.phone in (v_phone, '+234' || substr(v_phone, 2))
   order by exists (select 1 from public.customer_credentials cc where cc.customer_id = c.id) desc,
            c.created_at
   limit 1;

  if v_id is null then
    begin
      insert into public.customers (phone, name, email)
      values (v_phone, v_name, v_email)
      returning id into v_id;
    exception when unique_violation then
      select c.id into v_id from public.customers c
       where c.phone in (v_phone, '+234' || substr(v_phone, 2))
       order by c.created_at limit 1;
    end;
  else
    update public.customers c
       set name  = coalesce(nullif(c.name, ''),  v_name),
           email = coalesce(nullif(c.email, ''), v_email)
     where c.id = v_id
       and ((coalesce(c.name, '') = '' and v_name is not null)
         or (coalesce(c.email, '') = '' and v_email is not null));
  end if;

  new.customer_id := v_id;
  return new;
end;
$$;
revoke all on function public.orders_link_customer() from public, anon, authenticated;

drop trigger if exists orders_link_customer on public.orders;
create trigger orders_link_customer
  before insert on public.orders
  for each row execute function public.orders_link_customer();

-- 0.9 Items may only be added to an order the DATABASE saw inserted
--     in the last 30 minutes (anon can't read orders after Step A,
--     so the policy needs this definer helper).
create or replace function public.order_accepts_items(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
     where o.id::text = p_order_id
       and o.inserted_at > now() - interval '30 minutes'
  )
$$;
revoke all on function public.order_accepts_items(text) from public;
grant execute on function public.order_accepts_items(text) to anon, authenticated;

commit;


-- ============================================================
--  STEP A — Phase 1 (orders reads now go through customer-data)
--  Run ONLY after the Phase 1 site code is live and tested.
-- ============================================================
/*
begin;

select public.lockdown_snapshot('A', array['orders', 'order_items', 'order_tracking_attempts']);
select public.lockdown_drop_policies(array['orders', 'order_items', 'order_tracking_attempts']);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Admin pages (Supabase Auth): full access, narrowed further by the
-- phase-2 admin_role_* restrictive policies if those have run.
create policy lockdown_admin_all on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lockdown_admin_all on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Checkout (anon): INSERT only, no reading back. Payment fields are
-- still policed by orders_guard_payment_fields (paystack_payment_guard.sql).
create policy lockdown_anon_checkout_insert on public.orders
  for insert to anon
  with check (
        status in ('pending_payment', 'confirmed')
    and created_at > now() - interval '2 days'      -- offline retry queue
    and created_at < now() + interval '1 hour'      -- device clock skew
    and admin_note is null
    and admin_notified_at is null
    and customer_email_sent_at is null
  );

create policy lockdown_anon_checkout_insert on public.order_items
  for insert to anon
  with check (public.order_accepts_items(order_id::text));

-- Live grants are ALL (incl. TRUNCATE, TRIGGER, REFERENCES, MAINTAIN)
-- for both roles. TRUNCATE ignores RLS, so strip everything from BOTH
-- roles, then grant back only what is needed.
revoke all on public.orders, public.order_items from anon, authenticated;
grant insert on public.orders, public.order_items to anon;
grant select, insert, update, delete on public.orders, public.order_items to authenticated;

-- Old browser-side tracking rate limit: server-only from now on.
do $$
begin
  if to_regclass('public.order_tracking_attempts') is not null then
    execute 'alter table public.order_tracking_attempts enable row level security';
    execute 'revoke all on public.order_tracking_attempts from anon, authenticated';
  end if;
end;
$$;

commit;
*/


-- ============================================================
--  STEP B — Phase 2 (customer-auth + addresses live)
--  Run ONLY after the Phase 2 site code is live and tested.
--  Everyone signs in again once (old sessions are deleted).
-- ============================================================
/*
begin;

select public.lockdown_snapshot('B', array['customers', 'customer_sessions', 'customer_addresses',
                                           'customer_otp_challenges', 'customer_credentials']);

-- Hashes: copy, then clear the public column (dropped in Step D).
insert into public.customer_credentials (customer_id, password_hash)
select id, password_hash from public.customers where password_hash is not null
on conflict (customer_id) do nothing;
update public.customers set password_hash = null where password_hash is not null;

-- Browser-minted plain-text sessions can't be trusted: delete them.
delete from public.customer_sessions where token_hash is null;

select public.lockdown_drop_policies(array['customers', 'customer_sessions', 'customer_addresses',
                                           'customer_otp_challenges', 'customer_credentials']);

alter table public.customers               enable row level security;
alter table public.customer_sessions       enable row level security;
alter table public.customer_addresses      enable row level security;
alter table public.customer_otp_challenges enable row level security;

create policy lockdown_admin_all on public.customers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy lockdown_admin_all on public.customer_addresses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- customer_sessions, customer_otp_challenges, customer_credentials:
-- no policies at all = service role only.

-- Strip ALL (incl. TRUNCATE etc.) from both roles, then give admins
-- back plain read/write on the two tables they use.
revoke all on public.customers, public.customer_sessions, public.customer_addresses,
              public.customer_otp_challenges, public.customer_credentials from anon, authenticated;
grant select, insert, update, delete on public.customers, public.customer_addresses to authenticated;

commit;
*/


-- ============================================================
--  STEP C — Phase 3 (reviews go through customer-data)
--  Run ONLY after the Phase 3 site code is live.
--
--  · Public reads: product_reviews_public() and
--    product_review_summary() only (approved reviews; author shown
--    as "First L."; never customer_id, phone or order_id).
--  · products.rating / products.reviews = APPROVED reviews only,
--    kept current by the reviews_recompute trigger.
--  · anon/authenticated lose direct access to reviews; admins
--    (Supabase Auth + admin_roles) keep full access for moderation.
--    Customer writes come from customer-data (service role).
-- ============================================================
/*
begin;

-- C.1 Save the current recompute function + its triggers so the
--     rollback can put them back exactly.
create table if not exists public.lockdown_function_backup (
  id         bigint generated always as identity primary key,
  step       text not null,
  taken_at   timestamptz not null default now(),
  kind       text not null check (kind in ('function', 'trigger')),
  name       text not null,
  definition text not null
);
alter table public.lockdown_function_backup enable row level security;
revoke all on public.lockdown_function_backup from anon, authenticated;

do $$
begin
  if exists (select 1 from public.lockdown_function_backup where step = 'C') then
    raise notice 'Function backup for step C already exists; keeping the original.';
  elsif to_regprocedure('public.reviews_recompute_trigger()') is not null then
    insert into public.lockdown_function_backup (step, kind, name, definition)
    select 'C', 'function', 'reviews_recompute_trigger',
           pg_get_functiondef('public.reviews_recompute_trigger()'::regprocedure);
    insert into public.lockdown_function_backup (step, kind, name, definition)
    select 'C', 'trigger', t.tgname, pg_get_triggerdef(t.oid)
      from pg_trigger t
     where t.tgrelid = 'public.reviews'::regclass and not t.tgisinternal
       and t.tgfoid = 'public.reviews_recompute_trigger()'::regprocedure;
  end if;
end;
$$;

-- C.2 Comment and title are optional now (rating is the only
--     required field). No-ops if they are already nullable.
alter table public.reviews alter column body  drop not null;
alter table public.reviews alter column title drop not null;

-- C.3 Public list: approved only, filter by star, sort, paginate.
drop function if exists public.product_reviews_public(text, int, int);
create or replace function public.product_reviews_public(
  p_sku    text,
  p_limit  int  default 10,
  p_offset int  default 0,
  p_rating int  default null,       -- 1..5 = only that star; null = all
  p_sort   text default 'newest'    -- 'newest' | 'highest' | 'lowest'
)
returns table (id text, rating int, title text, body text, created_at timestamptz,
               author text, verified boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.id::text, r.rating::int, r.title, r.body, r.created_at,
         coalesce(
           nullif(split_part(n.clean_name, ' ', 1) ||
                  case when split_part(n.clean_name, ' ', 2) <> ''
                       then ' ' || upper(left(split_part(n.clean_name, ' ', 2), 1)) || '.' else '' end, ''),
           'NAVEN customer'),
         r.order_id is not null
    from public.reviews r
    left join public.customers c on c.id = r.customer_id
    -- "  Chidi   Nwosu Okafor " → "Chidi Nwosu Okafor" → shown as "Chidi N."
    cross join lateral (select regexp_replace(trim(coalesce(c.name, '')), '\s+', ' ', 'g') as clean_name) n
   where r.product_sku = p_sku
     and r.status = 'approved'
     and (p_rating is null or r.rating = p_rating)
   order by
     case when p_sort = 'highest' then r.rating end desc nulls last,
     case when p_sort = 'lowest'  then r.rating end asc  nulls last,
     r.created_at desc,
     r.id desc
   limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

-- C.4 Summary: average (1 decimal), total, count per star.
create or replace function public.product_review_summary(p_sku text)
returns table (average numeric, total int, stars jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select round(coalesce(avg(r.rating), 0)::numeric, 1),
         count(*)::int,
         jsonb_build_object(
           '5', count(*) filter (where r.rating = 5), '4', count(*) filter (where r.rating = 4),
           '3', count(*) filter (where r.rating = 3), '2', count(*) filter (where r.rating = 2),
           '1', count(*) filter (where r.rating = 1))
    from public.reviews r
   where r.product_sku = p_sku and r.status = 'approved'
$$;

revoke all on function public.product_reviews_public(text, int, int, int, text) from public;
revoke all on function public.product_review_summary(text) from public;
grant execute on function public.product_reviews_public(text, int, int, int, text) to anon, authenticated;
grant execute on function public.product_review_summary(text) to anon, authenticated;

-- C.5 products.rating / products.reviews from APPROVED reviews only.
--     rating is null when there are none (cards show no stars).
create or replace function public.reviews_recompute_product(p_sku text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
     set rating  = s.avg_rating,
         reviews = s.n
    from (select round(avg(r.rating)::numeric, 1) as avg_rating, count(*)::int as n
            from public.reviews r
           where r.product_sku = p_sku and r.status = 'approved') s
   where p.sku = p_sku
     and (p.rating is distinct from s.avg_rating or p.reviews is distinct from s.n)
$$;
revoke all on function public.reviews_recompute_product(text) from public, anon, authenticated;

create or replace function public.reviews_recompute_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.reviews_recompute_product(new.product_sku);
  elsif tg_op = 'DELETE' then
    perform public.reviews_recompute_product(old.product_sku);
  else
    if old.status is not distinct from new.status
       and old.rating is not distinct from new.rating
       and old.product_sku is not distinct from new.product_sku then
      return null;                                   -- text-only edit: totals unchanged
    end if;
    perform public.reviews_recompute_product(old.product_sku);
    if new.product_sku is distinct from old.product_sku then
      perform public.reviews_recompute_product(new.product_sku);
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.reviews_recompute_trigger() from public, anon, authenticated;

-- One trigger, whatever the old one was called.
do $$
declare t record;
begin
  for t in
    select tgname from pg_trigger
     where tgrelid = 'public.reviews'::regclass and not tgisinternal
       and tgfoid = 'public.reviews_recompute_trigger()'::regprocedure
  loop
    execute format('drop trigger %I on public.reviews', t.tgname);
  end loop;
end;
$$;
create trigger reviews_recompute
  after insert or update or delete on public.reviews
  for each row execute function public.reviews_recompute_trigger();

-- C.6 Access: no direct anon/customer access; admins keep moderation.
select public.lockdown_snapshot('C', array['reviews']);
select public.lockdown_drop_policies(array['reviews']);
alter table public.reviews enable row level security;
create policy lockdown_admin_all on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.reviews from anon, authenticated;   -- incl. TRUNCATE etc.
grant select, insert, update, delete on public.reviews to authenticated;

-- C.7 Recompute every product once (clears any old seeded numbers).
select count(*) as products_checked
  from (select public.reviews_recompute_product(sku) from public.products) x;

commit;
*/


-- ============================================================
--  STEP D — clean-up (a few weeks after Step B, once stable)
-- ============================================================
/*
alter table public.customers         drop column if exists password_hash;
alter table public.customer_sessions drop column if exists token;
drop table if exists public.order_tracking_attempts;
*/
