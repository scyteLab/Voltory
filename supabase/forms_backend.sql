-- ============================================================
--  Public forms backend  (PROPOSED — review, then run in the
--  Supabase SQL editor; nothing in the app runs this)
--
--  Adds the two tables every non-order storefront form writes to:
--
--    · newsletter_subscribers — Footer + Blog "Notify me"
--    · form_submissions       — Installation booking, Affiliate
--                               application, Careers application
--                               (one row per submission, form_type
--                               says which form; the form-specific
--                               fields live in `data`)
--
--  contact_messages is NOT touched (see contact_messages.sql).
--  warranty_claims / reviews / whatsapp_quotes are NOT touched.
--
--  Access model (same as contact_messages):
--    · anon (any visitor)  INSERT only, and only as a fresh row
--                          (status 'new' / 'subscribed', no admin_note).
--                          No SELECT / UPDATE / DELETE.
--    · authenticated       SELECT / UPDATE / DELETE  (= admins; customers
--                          never get a Supabase Auth session).
--
--  The storefront inserts WITHOUT reading the row back
--  (Prefer: return=minimal), so anon needs no SELECT right.
--
--  Email notifications are NOT created here. They come from
--  Supabase Database Webhooks (Dashboard → Database → Webhooks)
--  calling netlify/functions/notify-event.js — see the
--  checklist in the commit / handover notes.
--
--  Safe to re-run.
-- ============================================================


-- ------------------------------------------------------------
-- 1. newsletter_subscribers
-- ------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  email       text not null,
  source      text not null default 'footer',
  topics      text[] not null default '{}',
  status      text not null default 'subscribed'
              check (status in ('subscribed', 'unsubscribed')),

  constraint newsletter_subscribers_email_len    check (char_length(email) between 3 and 254),
  constraint newsletter_subscribers_email_lower  check (email = lower(email)),
  constraint newsletter_subscribers_email_format check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  constraint newsletter_subscribers_source_len   check (char_length(source) <= 40),
  constraint newsletter_subscribers_topics_len   check (coalesce(array_length(topics, 1), 0) <= 20)
);

-- One row per address. A repeat signup fails with 23505 and the
-- storefront shows "You're already subscribed".
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (email);
create index if not exists newsletter_subscribers_created_at_idx
  on public.newsletter_subscribers (created_at desc);

-- Normalise before the checks run, so " Me@X.com " is stored (and
-- de-duplicated) as "me@x.com" even if a client forgets to.
create or replace function public.newsletter_subscribers_normalise()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists newsletter_subscribers_normalise on public.newsletter_subscribers;
create trigger newsletter_subscribers_normalise
  before insert or update of email on public.newsletter_subscribers
  for each row execute function public.newsletter_subscribers_normalise();

alter table public.newsletter_subscribers enable row level security;

drop policy if exists "public insert newsletter_subscribers" on public.newsletter_subscribers;
create policy "public insert newsletter_subscribers" on public.newsletter_subscribers
  for insert to anon, authenticated
  with check (status = 'subscribed');

drop policy if exists "admin read newsletter_subscribers" on public.newsletter_subscribers;
create policy "admin read newsletter_subscribers" on public.newsletter_subscribers
  for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists "admin update newsletter_subscribers" on public.newsletter_subscribers;
create policy "admin update newsletter_subscribers" on public.newsletter_subscribers
  for update to authenticated
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin delete newsletter_subscribers" on public.newsletter_subscribers;
create policy "admin delete newsletter_subscribers" on public.newsletter_subscribers
  for delete to authenticated
  using (auth.role() = 'authenticated');


-- ------------------------------------------------------------
-- 2. form_submissions
-- ------------------------------------------------------------
create table if not exists public.form_submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  form_type   text not null,
  name        text not null,
  email       text,
  phone       text,
  data        jsonb not null default '{}'::jsonb,
  status      text not null default 'new'
              check (status in ('new', 'in_progress', 'done')),
  admin_note  text,

  -- Add a form here (and a tab in AdminInbox) when a new one ships,
  -- e.g. 'callback'.
  constraint form_submissions_form_type check (form_type in ('installation', 'affiliate', 'careers')),
  constraint form_submissions_name_len  check (char_length(name) between 1 and 120),
  constraint form_submissions_email_len check (email is null or char_length(email) <= 254),
  constraint form_submissions_phone_len check (phone is null or char_length(phone) <= 40),
  constraint form_submissions_note_len  check (admin_note is null or char_length(admin_note) <= 5000),
  constraint form_submissions_data_obj  check (jsonb_typeof(data) = 'object'),
  -- Whole extra-fields object, serialised. Each text field is capped
  -- in the browser too; this stops a bot stuffing megabytes.
  constraint form_submissions_data_len  check (octet_length(data::text) <= 16000),
  -- Every form needs a way to reply.
  constraint form_submissions_has_contact check (email is not null or phone is not null)
);

create index if not exists form_submissions_type_created_idx
  on public.form_submissions (form_type, created_at desc);
create index if not exists form_submissions_status_idx
  on public.form_submissions (form_type, status);

-- Server-side 30s cooldown: the same email or phone can't submit the
-- same form twice within 30 seconds. (The browser enforces the same
-- cooldown; this catches scripts that skip the page.) SECURITY DEFINER
-- because anon has no SELECT right on the table.
create or replace function public.form_submissions_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.form_submissions s
     where s.form_type = new.form_type
       and s.created_at > now() - interval '30 seconds'
       and ((new.email is not null and lower(s.email) = lower(new.email))
         or (new.phone is not null and s.phone = new.phone))
  ) then
    raise exception 'rate_limited: please wait 30 seconds before sending again'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists form_submissions_cooldown on public.form_submissions;
create trigger form_submissions_cooldown
  before insert on public.form_submissions
  for each row execute function public.form_submissions_cooldown();

alter table public.form_submissions enable row level security;

drop policy if exists "public insert form_submissions" on public.form_submissions;
create policy "public insert form_submissions" on public.form_submissions
  for insert to anon, authenticated
  with check (status = 'new' and admin_note is null);

drop policy if exists "admin read form_submissions" on public.form_submissions;
create policy "admin read form_submissions" on public.form_submissions
  for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists "admin update form_submissions" on public.form_submissions;
create policy "admin update form_submissions" on public.form_submissions
  for update to authenticated
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin delete form_submissions" on public.form_submissions;
create policy "admin delete form_submissions" on public.form_submissions
  for delete to authenticated
  using (auth.role() = 'authenticated');

-- No policy grants anon SELECT / UPDATE / DELETE on either table, so
-- with RLS on those requests return nothing / change nothing.

-- Check after running (as anon, e.g. from the browser console):
--   select → [] ; insert → 201 ; update/delete → 0 rows affected.
--   Same newsletter email twice → second insert 409 (code 23505).
--   Same installation phone twice within 30s → 400 "rate_limited".
