-- ============================================================
--  Admin roles: gm / store / support
--
--  Run this BEFORE (or right after) deploying the role-based admin.
--  Until it runs, the app still works: 'staff' is read as 'store',
--  but the Team page can't list or add people (it needs the new
--  deactivated_at column) and internal order notes can't be saved.
--
--  What it does
--    1. admin_roles.role may be 'gm', 'store' or 'support'.
--       Existing 'staff' rows become 'store' (closest match: staff
--       could do everything except GM approvals).
--    2. admin_roles.deactivated_at — set by the Team page when the
--       GM deactivates someone. The app treats a deactivated row as
--       "no role", and the sign-in account is banned as well.
--    3. orders.admin_note — the staff-only "Internal notes" box on
--       the order page (Store and Support can write it).
--    4. approvals.action_type may also be price_change,
--       price_bulk_change, offer_change and order_cancel (filed by
--       Store, decided in the GM Portal).
--
--  The Team page writes admin_roles through the admin-team Netlify
--  function with the service role key, so no browser policy is
--  needed for that.
--
--  Safe to re-run.
-- ============================================================


-- 1. Allowed roles ------------------------------------------------------
-- The original check constraint isn't in this repo, so drop whatever
-- check mentions "role" on admin_roles before adding ours.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.admin_roles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.admin_roles drop constraint %I', c.conname);
  end loop;
end;
$$;

update public.admin_roles set role = 'store' where role = 'staff';

alter table public.admin_roles
  add constraint admin_roles_role_check
  check (role in ('gm', 'store', 'support'));


-- 2. Deactivation -------------------------------------------------------
alter table public.admin_roles
  add column if not exists deactivated_at timestamptz;


-- 3. Internal order notes ----------------------------------------------
alter table public.orders
  add column if not exists admin_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass and conname = 'orders_admin_note_len'
  ) then
    alter table public.orders
      add constraint orders_admin_note_len
      check (admin_note is null or char_length(admin_note) <= 5000);
  end if;
end;
$$;


-- 4. Approval types -----------------------------------------------------
-- Same approach: drop any existing action_type check, add the full list.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.approvals'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%action_type%'
  loop
    execute format('alter table public.approvals drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.approvals
  add constraint approvals_action_type_check
  check (action_type in (
    'admin_role_change',
    'price_change',
    'price_bulk_change',
    'offer_change',
    'order_cancel'
  ));


-- 5. Check the result ---------------------------------------------------
-- Everyone with a role, after the update (run on its own if you like):
--   select r.role, u.email, r.deactivated_at
--   from public.admin_roles r join auth.users u on u.id = r.user_id
--   order by r.role, u.email;
