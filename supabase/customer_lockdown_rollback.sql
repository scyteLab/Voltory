-- ============================================================
--  CUSTOMER DATA LOCKDOWN — ROLLBACK  (DRAFT)
--
--  Pairs with supabase/customer_lockdown.sql. Each block undoes ONE
--  step by restoring the policies and grants snapshotted into
--  public.lockdown_backup just before that step ran. Run only the
--  block you need, newest step first (C, then B, then A).
--
--  Restoring a step also brings back the anon access it removed, so
--  roll the SITE back to the matching build only if the new code is
--  the problem; the new functions work with either database state.
-- ============================================================


-- Helper: restore one step's tables to their snapshot. Drops every
-- policy on those tables except the phase-2 admin_role_* ones, then
-- re-creates the saved policies and grants for anon/authenticated.
create or replace function public.lockdown_restore(p_step text)
returns void
language plpgsql
set search_path = public
as $$
declare
  t record;
  p record;
  g record;
begin
  if not exists (select 1 from public.lockdown_backup where step = p_step and kind = 'table') then
    raise exception 'No snapshot for step %; nothing to restore.', p_step;
  end if;

  for t in select distinct tablename from public.lockdown_backup where step = p_step and kind = 'table' loop
    perform public.lockdown_drop_policies(array[t.tablename]);
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;

  for p in
    select * from public.lockdown_backup
     where step = p_step and kind = 'policy' and policyname not like 'admin\_role\_%'
  loop
    execute format(
      'create policy %I on public.%I as %s for %s to %s%s%s',
      p.policyname, p.tablename, p.permissive, p.cmd,
      (select string_agg(quote_ident(x), ', ') from unnest(p.roles) x),
      case when p.qual       is not null then ' using (' || p.qual || ')' else '' end,
      case when p.with_check is not null then ' with check (' || p.with_check || ')' else '' end
    );
  end loop;

  for g in select * from public.lockdown_backup where step = p_step and kind = 'grant' loop
    execute format('grant %s on public.%I to %I', g.privilege, g.tablename, g.grantee);
  end loop;

  -- Mark the snapshot as used (kept for the record; a later re-run of
  -- the step will reuse this original snapshot, not a new one).
  raise notice 'Step % restored from snapshot taken %.',
    p_step, (select min(taken_at) from public.lockdown_backup where step = p_step);
end;
$$;
revoke all on function public.lockdown_restore(text) from public, anon, authenticated;


-- ============================================================
--  ROLLBACK STEP C — reviews
-- ============================================================
/*
begin;
select public.lockdown_restore('C');
drop function if exists public.product_reviews_public(text, int, int, int, text);
drop function if exists public.product_reviews_public(text, int, int);
drop function if exists public.product_review_summary(text);

-- Put back the recompute function + triggers saved by Step C.1 (if
-- there were none, the new approved-only trigger stays: it is safe).
do $$
declare b record;
begin
  if exists (select 1 from public.lockdown_function_backup where step = 'C') then
    drop trigger if exists reviews_recompute on public.reviews;
    for b in select definition from public.lockdown_function_backup
              where step = 'C' order by (kind = 'trigger'), id loop
      execute b.definition;
    end loop;
    drop function if exists public.reviews_recompute_product(text);
  end if;
end;
$$;
commit;
*/


-- ============================================================
--  ROLLBACK STEP B — customers, sessions, addresses, OTP table
--  Deleted plain-text sessions are NOT restored (people sign in
--  again). Password hashes are copied back to customers.
-- ============================================================
/*
begin;
select public.lockdown_restore('B');
update public.customers c
   set password_hash = cc.password_hash
  from public.customer_credentials cc
 where cc.customer_id = c.id
   and c.password_hash is null;
commit;
*/


-- ============================================================
--  ROLLBACK STEP A — orders, order_items, order_tracking_attempts
-- ============================================================
/*
begin;
select public.lockdown_restore('A');
commit;
*/


-- ============================================================
--  ROLLBACK STEP 0 — only if the checkout trigger misbehaves.
--  The rest of Step 0 is additive and harmless to leave in place.
--  The browser's old upsertFromCheckout() must still be live for
--  orders to keep getting a customer_id after this.
-- ============================================================
/*
drop trigger if exists orders_link_customer on public.orders;
*/
