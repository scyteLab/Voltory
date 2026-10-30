-- ============================================================
--  Dashboard views fix  (PROPOSED — review, then run in the
--  Supabase SQL editor; nothing in the app runs this)
--
--  Problem: the admin dashboard reads revenue_this_month,
--  orders_this_month, new_warranty_claims_this_month, total_revenue,
--  total_products, ... from dashboard_kpis, but the view only has
--  pending_orders, open_warranty_claims, low_stock_count and
--  pending_reviews. Missing columns arrive as undefined, which the
--  dashboard renders as ₦0 / 0.
--
--  Definitions used everywhere below:
--    "Revenue" / "Orders" = orders whose status is NOT
--        cancelled, refunded or pending_payment
--    Days and months are Nigerian time (Africa/Lagos, UTC+1).
--
--  Rules followed:
--    · CREATE OR REPLACE VIEW, existing columns first with the same
--      names and types (Postgres refuses to change them), new
--      columns only at the end.
--    · CREATE OR REPLACE VIEW resets a view's WITH (...) options
--      (e.g. security_invoker), so this script saves each view's
--      current options first and re-applies them at the end.
--      Ownership and GRANTs are kept by CREATE OR REPLACE.
--    · orders_status_breakdown and low_stock_products are unchanged.
--
--  Before running, you can compare with the current definitions:
--    select pg_get_viewdef('public.dashboard_kpis', true);
--    select pg_get_viewdef('public.sales_by_day', true);
--    select pg_get_viewdef('public.top_products_by_units', true);
--  and their options:
--    select relname, reloptions from pg_class
--     where relname in ('dashboard_kpis','sales_by_day','top_products_by_units');
--
--  All in one transaction: if any statement fails, nothing changes.
-- ============================================================

begin;

-- 0. Remember each view's current security options -------------------
create temp table _dashboard_view_opts on commit drop as
select c.relname, c.reloptions
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'v'
  and c.relname in ('dashboard_kpis', 'sales_by_day', 'top_products_by_units');


-- 1. dashboard_kpis --------------------------------------------------
-- Existing columns (all bigint, unchanged order):
--   pending_orders        NOW: orders needing action (confirmed, processing)
--   open_warranty_claims  NOW: statuses the app uses (submitted, under_review)
--   low_stock_count       unchanged (active products with stock < 5)
--   pending_reviews       unchanged
-- New columns (appended):
--   awaiting_payment, revenue_this_month, orders_this_month,
--   revenue_prev_month_to_date, orders_prev_month_to_date,
--   new_warranty_claims_this_month, total_revenue, total_orders,
--   total_products, total_active_products, out_of_stock_count
--
-- "vs prior" compares month-to-date with the SAME number of days of
-- last month (1st → today's date), not with all of last month, so a
-- month that has only just started doesn't look like a collapse.
create or replace view public.dashboard_kpis as
with bounds as (
  select
    (date_trunc('month', now() at time zone 'Africa/Lagos')) at time zone 'Africa/Lagos'                       as month_start,
    (date_trunc('month', now() at time zone 'Africa/Lagos') - interval '1 month') at time zone 'Africa/Lagos'  as prev_month_start,
    now() - interval '1 month'                                                                                  as prev_month_same_point
),
counted_orders as (
  select o.total, o.created_at
  from public.orders o
  where o.status not in ('cancelled', 'refunded', 'pending_payment')
)
select
  (select count(*) from public.orders
     where status in ('confirmed', 'processing'))                                   as pending_orders,
  (select count(*) from public.warranty_claims
     where status in ('submitted', 'under_review'))                                 as open_warranty_claims,
  (select count(*) from public.products
     where stock < 5 and status = 'active')                                         as low_stock_count,
  (select count(*) from public.reviews
     where status = 'pending')                                                      as pending_reviews,
  -- new columns ↓
  (select count(*) from public.orders
     where status = 'pending_payment')                                              as awaiting_payment,
  (select coalesce(sum(total), 0) from counted_orders, bounds
     where created_at >= bounds.month_start)::bigint                                as revenue_this_month,
  (select count(*) from counted_orders, bounds
     where created_at >= bounds.month_start)                                        as orders_this_month,
  (select coalesce(sum(total), 0) from counted_orders, bounds
     where created_at >= bounds.prev_month_start
       and created_at <  bounds.prev_month_same_point)::bigint                      as revenue_prev_month_to_date,
  (select count(*) from counted_orders, bounds
     where created_at >= bounds.prev_month_start
       and created_at <  bounds.prev_month_same_point)                              as orders_prev_month_to_date,
  (select count(*) from public.warranty_claims, bounds
     where created_at >= bounds.month_start)                                        as new_warranty_claims_this_month,
  (select coalesce(sum(total), 0) from counted_orders)::bigint                      as total_revenue,
  (select count(*) from counted_orders)                                             as total_orders,
  (select count(*) from public.products)                                            as total_products,
  (select count(*) from public.products where status = 'active')                    as total_active_products,
  (select count(*) from public.products
     where stock <= 0 and status = 'active')                                        as out_of_stock_count;


-- 2. sales_by_day ----------------------------------------------------
-- Columns unchanged: day date, revenue bigint, order_count bigint.
-- Last 30 days in Nigerian time, one row per day INCLUDING days with
-- no sales (revenue 0), oldest first, so charts have no gaps.
create or replace view public.sales_by_day as
with days as (
  select generate_series(
           (now() at time zone 'Africa/Lagos')::date - 29,
           (now() at time zone 'Africa/Lagos')::date,
           interval '1 day'
         )::date as day
),
counted as (
  select (o.created_at at time zone 'Africa/Lagos')::date as day, o.total
  from public.orders o
  where o.status not in ('cancelled', 'refunded', 'pending_payment')
    and o.created_at >= ((now() at time zone 'Africa/Lagos')::date - 29) at time zone 'Africa/Lagos'
)
select
  d.day,
  coalesce(sum(c.total), 0)::bigint as revenue,
  count(c.day)::bigint              as order_count
from days d
left join counted c on c.day = d.day
group by d.day
order by d.day;


-- 3. top_products_by_units --------------------------------------------
-- Columns unchanged: sku text, product_name text, units_sold integer,
-- revenue bigint, order_count integer. Best sellers first.
create or replace view public.top_products_by_units as
select
  oi.sku,
  max(oi.product_name)               as product_name,
  sum(oi.qty)::integer               as units_sold,
  sum(oi.line_total)::bigint         as revenue,
  count(distinct oi.order_id)::integer as order_count
from public.order_items oi
join public.orders o on o.id = oi.order_id
where o.status not in ('cancelled', 'refunded', 'pending_payment')
group by oi.sku
order by units_sold desc, revenue desc;


-- 4. Re-apply the saved security options ------------------------------
do $$
declare
  r record;
begin
  for r in select relname, reloptions from _dashboard_view_opts where reloptions is not null loop
    execute format('alter view public.%I set (%s)', r.relname, array_to_string(r.reloptions, ', '));
  end loop;
end $$;

commit;

-- Check afterwards (options should match what you saw before):
--   select relname, reloptions from pg_class
--    where relname in ('dashboard_kpis','sales_by_day','top_products_by_units');
--   select * from public.dashboard_kpis;
