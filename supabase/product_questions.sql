-- ============================================================
--  PRODUCT QUESTIONS & ANSWERS
--
--  Run ONCE in the Supabase SQL editor, AFTER the site code that
--  uses it is live (customer-data "question-*" actions, Admin →
--  Questions, the product page Q&A section).
--
--  Needs: customer_lockdown.sql Step 0 (public.is_admin()) and
--  schema.sql (public.set_updated_at()). Safe to re-run.
--
--  · Table product_questions. Customers never touch it directly:
--    they ask / delete / list through the customer-data function
--    (service role). Admins (Supabase Auth + admin_roles) moderate
--    and answer it directly, through RLS (public.is_admin()).
--  · Public reads ONLY through product_questions_public() and
--    product_questions_count(): published AND answered questions,
--    asker shown as "First L.", never customer_id, phone or email.
--  · products.questions = number of published + answered questions,
--    kept current by a trigger.
--  · answered_notified_at: notify-event claims it before emailing
--    the customer, so the "your question was answered" email goes
--    out once.
--
--  The ROLLBACK block is at the bottom (commented out).
-- ============================================================

begin;

-- 0. Preconditions
do $$
begin
  if to_regprocedure('public.is_admin()') is null then
    raise exception 'public.is_admin() is missing: run customer_lockdown.sql Step 0 first.';
  end if;
  if to_regprocedure('public.set_updated_at()') is null then
    raise exception 'public.set_updated_at() is missing: run schema.sql first.';
  end if;
end;
$$;

-- 1. Keep the current products.questions numbers, so the rollback
--    can put them back (they are recomputed in step 7).
create table if not exists public.product_questions_count_backup (
  sku       text primary key,
  questions integer,
  taken_at  timestamptz not null default now()
);
alter table public.product_questions_count_backup enable row level security;
revoke all on public.product_questions_count_backup from anon, authenticated;

alter table public.products add column if not exists questions integer default 0;

insert into public.product_questions_count_backup (sku, questions)
select sku, questions from public.products
on conflict (sku) do nothing;            -- a re-run keeps the ORIGINAL numbers

-- 2. Table
create table if not exists public.product_questions (
  id                   uuid primary key default gen_random_uuid(),
  product_sku          text not null references public.products (sku) on delete cascade on update cascade,
  customer_id          uuid not null references public.customers (id) on delete cascade,
  question             text not null,
  status               text not null default 'pending',
  answer               text,
  answered_by          uuid,             -- auth.users id of the staff member (last edit)
  answered_at          timestamptz,      -- first time an answer was saved
  admin_note           text,             -- shown to the customer when not published
  answered_notified_at timestamptz,      -- customer emailed (claimed by notify-event)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint product_questions_question_len check (char_length(question) between 10 and 500),
  constraint product_questions_status_check check (status in ('pending', 'published', 'rejected')),
  constraint product_questions_answer_len check (answer is null or char_length(answer) between 1 and 2000),
  constraint product_questions_published_answered check (status <> 'published' or nullif(btrim(answer), '') is not null)
);

create index if not exists product_questions_sku_status_created
  on public.product_questions (product_sku, status, created_at desc);
create index if not exists product_questions_customer
  on public.product_questions (customer_id);

drop trigger if exists product_questions_set_updated_at on public.product_questions;
create trigger product_questions_set_updated_at
  before update on public.product_questions
  for each row execute function public.set_updated_at();

-- 3. Stamp who answered and when. Not trusted from the browser: an
--    admin's update can't fake another staff member or a date.
create or replace function public.product_questions_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.answered_by := case when new.answer is null then null else auth.uid() end;
    new.answered_at := case when new.answer is null then null else now() end;
    new.answered_notified_at := null;
    return new;
  end if;
  if new.answer is distinct from old.answer then
    if new.answer is null then
      new.answered_by := null;
      new.answered_at := null;
    else
      new.answered_by := coalesce(auth.uid(), old.answered_by);
      new.answered_at := coalesce(old.answered_at, now());
    end if;
  else
    new.answered_by := old.answered_by;
    new.answered_at := old.answered_at;
  end if;
  return new;
end;
$$;
revoke all on function public.product_questions_stamp() from public, anon, authenticated;

drop trigger if exists product_questions_stamp on public.product_questions;
create trigger product_questions_stamp
  before insert or update on public.product_questions
  for each row execute function public.product_questions_stamp();

-- 4. Access: no direct anon / customer access; admins moderate.
alter table public.product_questions enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'product_questions' loop
    execute format('drop policy %I on public.product_questions', p.policyname);
  end loop;
end;
$$;
create policy product_questions_admin_all on public.product_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.product_questions from anon, authenticated;     -- incl. TRUNCATE, REFERENCES, TRIGGER
grant select, insert, update, delete on public.product_questions to authenticated;
grant all on public.product_questions to service_role;

-- 5. Public reads: published AND answered only. Newest first.
--    p_search filters question + answer text (plain substring, no
--    wildcards). Author = "First L." like reviews.
create or replace function public.product_questions_public(
  p_sku    text,
  p_limit  int  default 10,
  p_offset int  default 0,
  p_search text default null
)
returns table (id text, question text, answer text, asked_at timestamptz, answered_at timestamptz, author text)
language sql
stable
security definer
set search_path = public
as $$
  select q.id::text, q.question, q.answer, q.created_at, q.answered_at,
         coalesce(
           nullif(split_part(n.clean_name, ' ', 1) ||
                  case when split_part(n.clean_name, ' ', 2) <> ''
                       then ' ' || upper(left(split_part(n.clean_name, ' ', 2), 1)) || '.' else '' end, ''),
           'NAVEN customer')
    from public.product_questions q
    left join public.customers c on c.id = q.customer_id
    cross join lateral (select regexp_replace(trim(coalesce(c.name, '')), '\s+', ' ', 'g') as clean_name) n
    cross join lateral (select lower(nullif(btrim(coalesce(p_search, '')), '')) as term) s
   where q.product_sku = p_sku
     and q.status = 'published'
     and nullif(btrim(q.answer), '') is not null
     and (s.term is null
          or strpos(lower(q.question), s.term) > 0
          or strpos(lower(q.answer), s.term) > 0)
   order by q.created_at desc, q.id desc
   limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

create or replace function public.product_questions_count(p_sku text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.product_questions q
   where q.product_sku = p_sku
     and q.status = 'published'
     and nullif(btrim(q.answer), '') is not null
$$;

revoke all on function public.product_questions_public(text, int, int, text) from public;
revoke all on function public.product_questions_count(text) from public;
grant execute on function public.product_questions_public(text, int, int, text) to anon, authenticated;
grant execute on function public.product_questions_count(text) to anon, authenticated;

-- 6. products.questions = published + answered, kept current.
create or replace function public.product_questions_recompute_product(p_sku text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products p
     set questions = s.n
    from (select public.product_questions_count(p_sku) as n) s
   where p.sku = p_sku
     and p.questions is distinct from s.n
$$;
revoke all on function public.product_questions_recompute_product(text) from public, anon, authenticated;

create or replace function public.product_questions_recompute_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.product_questions_recompute_product(new.product_sku);
  elsif tg_op = 'DELETE' then
    perform public.product_questions_recompute_product(old.product_sku);
  else
    if old.status is not distinct from new.status
       and (nullif(btrim(old.answer), '') is null) = (nullif(btrim(new.answer), '') is null)
       and old.product_sku is not distinct from new.product_sku then
      return null;                         -- text edit / note / notified stamp: count unchanged
    end if;
    perform public.product_questions_recompute_product(old.product_sku);
    if new.product_sku is distinct from old.product_sku then
      perform public.product_questions_recompute_product(new.product_sku);
    end if;
  end if;
  return null;
end;
$$;
revoke all on function public.product_questions_recompute_trigger() from public, anon, authenticated;

drop trigger if exists product_questions_recompute on public.product_questions;
create trigger product_questions_recompute
  after insert or update or delete on public.product_questions
  for each row execute function public.product_questions_recompute_trigger();

-- 7. Recompute every product once (clears any old seeded numbers).
select count(*) as products_checked
  from (select public.product_questions_recompute_product(sku) from public.products) x;

commit;


-- ============================================================
--  ROLLBACK — removes Q&A completely (questions are DELETED).
--  Delete the Supabase webhook on product_questions first
--  (Database → Webhooks); dropping the table removes its trigger
--  anyway.
-- ============================================================
/*
begin;

drop table if exists public.product_questions cascade;
drop function if exists public.product_questions_public(text, int, int, text);
drop function if exists public.product_questions_count(text);
drop function if exists public.product_questions_recompute_trigger();
drop function if exists public.product_questions_recompute_product(text);
drop function if exists public.product_questions_stamp();

-- products.questions back to what it was before this file ran.
update public.products p
   set questions = b.questions
  from public.product_questions_count_backup b
 where b.sku = p.sku
   and p.questions is distinct from b.questions;
drop table if exists public.product_questions_count_backup;

commit;
*/
