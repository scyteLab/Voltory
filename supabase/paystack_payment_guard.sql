-- ============================================================
--  Paystack payment guard for public.orders
--
--  Run once in the Supabase SQL editor BEFORE taking real payments.
--
--  Why: orders are written from the browser with the anon key, and
--  RLS on orders is still permissive (see docs/RLS_LOCKDOWN_PLAN.md).
--  Without this guard anyone holding the anon key could PATCH an
--  order to payment_status = 'paid', or lower its total before paying.
--
--  What it does:
--    1. Allows payment_status = 'pending' (online order awaiting Paystack).
--    2. Adds a trigger so that only the service role (our Netlify
--       paystack-verify / paystack-webhook functions) or a direct
--       SQL-editor session can set payment_status = 'paid'.
--       Browser (anon / authenticated) writes:
--         · can never set 'paid' (insert or update)
--         · can never change payment fields once an order is paid
--         · can never change order amounts after the order exists
--
--  Safe to re-run.
-- ============================================================

-- 1. Allow 'pending' -------------------------------------------------
do $$
declare
  col_type text;
  col_udt  text;
  con      record;
begin
  select data_type, udt_name into col_type, col_udt
  from information_schema.columns
  where table_schema = 'public' and table_name = 'orders' and column_name = 'payment_status';

  if col_type = 'USER-DEFINED' then
    execute format('alter type %I add value if not exists %L', col_udt, 'pending');
  else
    for con in
      select conname from pg_constraint
      where conrelid = 'public.orders'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) ilike '%payment_status%'
    loop
      execute format('alter table public.orders drop constraint %I', con.conname);
    end loop;
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded'));
  end if;
end $$;

-- 2. Guard trigger ---------------------------------------------------
-- NOT security definer: current_user must be the caller's role
-- (PostgREST switches to 'service_role' for the service key).
create or replace function public.orders_guard_payment_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.payment_status = 'paid' then
      new.payment_status := case when new.payment_method = 'pod' then 'unpaid' else 'pending' end;
    end if;
    return new;
  end if;

  -- UPDATE from the browser: amounts are fixed once the order exists.
  new.total            := old.total;
  new.subtotal         := old.subtotal;
  new.discount         := old.discount;
  new.delivery_fee     := old.delivery_fee;
  new.installation_fee := old.installation_fee;

  if old.payment_status = 'paid' then
    new.payment_status := old.payment_status;
    new.paystack_ref   := old.paystack_ref;
    new.payment_method := old.payment_method;
  elsif new.payment_status = 'paid' then
    new.payment_status := old.payment_status;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_payment_fields on public.orders;
create trigger orders_guard_payment_fields
  before insert or update on public.orders
  for each row execute function public.orders_guard_payment_fields();

-- 3. OPTIONAL one-off data fix ----------------------------------------
-- Before this release a storefront bug saved every order's
-- payment_method as 'transfer'. Online payment was disabled then, so
-- those orders were really Pay on Delivery. Review, then uncomment:
--
-- update public.orders
--    set payment_method = 'pod'
--  where payment_method = 'transfer'
--    and payment_status = 'unpaid'
--    and paystack_ref is null
--    and created_at < '2026-10-30';
