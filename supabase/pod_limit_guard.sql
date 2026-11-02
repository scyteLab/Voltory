-- ============================================================
--  Pay on Delivery order limit  (PROPOSED — review, then run in the
--  Supabase SQL editor; nothing in the app runs this)
--
--  An order with payment_method 'pod' and total above ₦450,000
--  can't be inserted, or updated into that state, by the browser
--  roles (anon = storefront, authenticated = admin console).
--
--  Allowed: service_role (Netlify functions) and postgres / the SQL
--  editor, so staff can still make a deliberate exception there.
--
--  Same limit in three places — keep them in step:
--    · src/config/site.js           SITE.podMaxOrderTotal (checkout UI)
--    · Netlify env                  POD_MAX_ORDER_TOTAL   (order-switch-pod)
--    · public.pod_max_order_total() below               (database)
--
--  Updates only trip the guard when payment_method or total actually
--  changes, so an admin can still move an older large POD order
--  through its statuses.
--
--  Safe to re-run.
-- ============================================================

create or replace function public.pod_max_order_total()
returns numeric
language sql
immutable
as $$ select 450000::numeric $$;

create or replace function public.orders_pod_limit_guard()
returns trigger
language plpgsql
as $$
begin
  -- Trigger functions run as the calling role: 'anon' / 'authenticated'
  -- for PostgREST requests from the browser, 'service_role' for the
  -- Netlify functions, 'postgres' in the SQL editor.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if new.payment_method::text = 'pod'
     and new.total > public.pod_max_order_total()
     and (tg_op = 'INSERT'
          or new.payment_method is distinct from old.payment_method
          or new.total is distinct from old.total)
  then
    raise exception 'pod_limit_exceeded: Pay on Delivery is available for orders up to ₦%',
      to_char(public.pod_max_order_total(), 'FM999,999,999')
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_pod_limit_guard on public.orders;
create trigger orders_pod_limit_guard
  before insert or update on public.orders
  for each row execute function public.orders_pod_limit_guard();

-- Check after running:
--   From the browser (anon): inserting an order with payment_method 'pod'
--   and total 450001 → 400 "pod_limit_exceeded…"; total 450000 → OK.
--   From the SQL editor the same insert succeeds (postgres is exempt).
--
-- Existing POD orders above the limit (left as they are):
--   select id, total, status from public.orders
--    where payment_method = 'pod' and total > public.pod_max_order_total();
