-- ============================================================
--  Email notifications — order bookkeeping
--
--  Team emails are sent by netlify/functions/notify-event.js, called
--  by Supabase Database Webhooks (Dashboard → Database → Webhooks).
--  The customer confirmation is sent by netlify/functions/send-email.js.
--  Both use the service role key, so they bypass RLS and the guard
--  below.
--
--    orders.admin_notified_at      — team "new order" email sent (once)
--    orders.customer_email_sent_at — customer confirmation sent (once)
--
--  Each function claims its column with
--    UPDATE … SET x = now() WHERE id = … AND x IS NULL
--  before sending, so retries and duplicate calls can't email twice.
--
--  Safe to re-run.
-- ============================================================


-- 1. Columns ----------------------------------------------------------
-- Added inside DO blocks so the one-off backfill runs only on the run
-- that creates each column: orders that existed before this feature
-- are treated as already emailed (they were, by the old browser code),
-- so nothing old gets emailed again.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'admin_notified_at'
  ) then
    alter table public.orders add column admin_notified_at timestamptz;
    update public.orders
      set admin_notified_at = created_at
      where status <> 'pending_payment';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'customer_email_sent_at'
  ) then
    alter table public.orders add column customer_email_sent_at timestamptz;
    update public.orders
      set customer_email_sent_at = created_at
      where status not in ('pending_payment', 'cancelled');
  end if;
end;
$$;


-- 2. Guard trigger ----------------------------------------------------
-- Only the server may set these. Otherwise a visitor could insert an
-- order with admin_notified_at already filled in and the team would
-- never hear about it, or an admin edit could clear one and re-send.
-- NOT security definer: current_user must be the caller's role
-- (PostgREST switches to 'service_role' for the service key).
create or replace function public.orders_guard_notify_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.admin_notified_at      := null;
    new.customer_email_sent_at := null;
  else
    new.admin_notified_at      := old.admin_notified_at;
    new.customer_email_sent_at := old.customer_email_sent_at;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_guard_notify_fields on public.orders;
create trigger orders_guard_notify_fields
  before insert or update on public.orders
  for each row execute function public.orders_guard_notify_fields();


-- 3. Item lookups -----------------------------------------------------
-- notify-event loads items by parent id right after each insert.
create index if not exists order_items_order_id_idx
  on public.order_items (order_id);
create index if not exists whatsapp_quote_items_quote_id_idx
  on public.whatsapp_quote_items (quote_id);
