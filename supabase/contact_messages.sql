-- ============================================================
--  Contact form messages  (PROPOSED — review, then run in the
--  Supabase SQL editor; nothing in the app runs this)
--
--  Written from the public Contact page with the anon key,
--  read and worked by admins in /admin/messages.
--
--  Access model:
--    · anon (any visitor)  INSERT only, and only as a fresh
--                          message (status 'new', no admin_note).
--                          No SELECT / UPDATE / DELETE.
--    · authenticated       SELECT / UPDATE / DELETE.
--      (= a Supabase Auth user; only admins have those — customers
--      sign in by phone and never get a Supabase Auth session, see
--      docs/RLS_LOCKDOWN_PLAN.md §2.1. Same rule as the existing
--      "admin write" policies in schema.sql and site_settings.sql.)
--
--  The storefront inserts WITHOUT reading the row back
--  (Prefer: return=minimal), so anon needs no SELECT right.
--
--  Safe to re-run.
-- ============================================================

create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text,
  phone       text,
  subject     text,
  message     text not null,
  status      text not null default 'new'
              check (status in ('new', 'replied', 'closed')),
  admin_note  text,

  -- Light sanity limits so a bot can't stuff megabytes into a row.
  constraint contact_messages_name_len    check (char_length(name) between 1 and 120),
  constraint contact_messages_email_len   check (email is null or char_length(email) <= 254),
  constraint contact_messages_phone_len   check (phone is null or char_length(phone) <= 40),
  constraint contact_messages_subject_len check (subject is null or char_length(subject) <= 200),
  constraint contact_messages_message_len check (char_length(message) between 1 and 5000),
  -- The form requires a way to reply.
  constraint contact_messages_has_contact check (email is not null or phone is not null)
);

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);
create index if not exists contact_messages_status_idx
  on public.contact_messages (status);

alter table public.contact_messages enable row level security;

-- Policies -----------------------------------------------------------
drop policy if exists "public insert contact_messages" on public.contact_messages;
create policy "public insert contact_messages" on public.contact_messages
  for insert to anon, authenticated
  with check (status = 'new' and admin_note is null);

drop policy if exists "admin read contact_messages" on public.contact_messages;
create policy "admin read contact_messages" on public.contact_messages
  for select to authenticated
  using (auth.role() = 'authenticated');

drop policy if exists "admin update contact_messages" on public.contact_messages;
create policy "admin update contact_messages" on public.contact_messages
  for update to authenticated
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "admin delete contact_messages" on public.contact_messages;
create policy "admin delete contact_messages" on public.contact_messages
  for delete to authenticated
  using (auth.role() = 'authenticated');

-- No policy grants anon SELECT / UPDATE / DELETE, so with RLS on
-- those requests return nothing / change nothing.

-- Check after running (as anon, e.g. from the browser console):
--   select → [] ; insert → 201 ; update/delete → 0 rows affected.
