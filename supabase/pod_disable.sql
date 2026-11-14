-- ============================================================
--  Pay on Delivery OFF for storefront orders
--
--  Run ONCE in the Supabase SQL editor, AFTER the site code with
--  SITE.payOnDeliveryEnabled = false is live (otherwise the old
--  checkout's POD option would fail with this error).
--
--  A BEFORE INSERT trigger on public.orders refuses any order with a
--  Pay on Delivery payment method ('pod', or the admin spelling
--  'pay_on_delivery') when it comes from the storefront's anon key,
--  so nobody can create a POD order by calling the API directly.
--
--  Not affected:
--    · authenticated (admin console): e.g. Admin → WA Quotes →
--      Convert records 'pay_on_delivery' ("Pay on Delivery (admin only)")
--    · service_role (Netlify functions) and postgres (SQL editor)
--    · existing POD orders: only INSERTs are checked
--
--  Works alongside orders_guard_notify_fields,
--  orders_guard_payment_fields, orders_link_customer and
--  orders_pod_limit_guard (all BEFORE triggers; the first one to
--  raise stops the insert).
--
--  To turn Pay on Delivery back on: run the ROLLBACK block at the
--  bottom, set SITE.payOnDeliveryEnabled = true and the Netlify env
--  var POD_ENABLED=true.
--
--  Safe to re-run.
-- ============================================================

begin;

-- NOT security definer: current_user must be the caller's role
-- (PostgREST switches to 'anon' / 'authenticated' / 'service_role').
create or replace function public.orders_pod_disabled_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'anon'
     and new.payment_method::text in ('pod', 'pay_on_delivery') then
    raise exception 'pod_disabled: Pay on Delivery is not available. Please pay online by bank transfer, card or USSD.'
      using errcode = 'P0001',
            hint = 'Choose Bank Transfer, Card or USSD at checkout.';
  end if;
  return new;
end;
$$;
revoke all on function public.orders_pod_disabled_guard() from public, anon, authenticated;

drop trigger if exists orders_pod_disabled_guard on public.orders;
create trigger orders_pod_disabled_guard
  before insert on public.orders
  for each row execute function public.orders_pod_disabled_guard();

commit;

-- Check after running (Table editor / API):
--   storefront (anon) insert with payment_method 'pod' → 400 "pod_disabled: …"
--   storefront (anon) insert with 'transfer'            → OK (pending_payment)
--   Admin → WA Quotes → Convert                          → OK ('pay_on_delivery')
--   Existing POD orders: unchanged, still listed and editable.


-- ============================================================
--  ROLLBACK — allows storefront POD inserts again.
-- ============================================================
/*
begin;
drop trigger if exists orders_pod_disabled_guard on public.orders;
drop function if exists public.orders_pod_disabled_guard();
commit;
*/
