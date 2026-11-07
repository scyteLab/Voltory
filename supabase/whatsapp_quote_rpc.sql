-- ============================================================
--  Send Cart to WhatsApp — save a quote in ONE request
--
--  public.create_whatsapp_quote(p_quote jsonb, p_items jsonb) → text
--
--  Inserts the whatsapp_quotes header and all its whatsapp_quote_items
--  in a single transaction (a function call is atomic: if any item is
--  rejected, the header is rolled back too) and returns the reference
--  actually saved.
--
--  The browser calls it once, with fetch keepalive, right after it
--  hands the customer to WhatsApp — so the save survives the page
--  navigating away (phones without the WhatsApp app).
--
--  SECURITY INVOKER (not definer): it runs with the caller's rights,
--  so the anon INSERT policies the storefront already relies on still
--  decide what may be written. The function opens nothing new; it
--  only adds validation and the single round-trip. (If phase-2 RLS
--  ever removes anon's direct INSERT on these tables, switch it to
--  SECURITY DEFINER at that point.)
--
--  Reference: NAV-Q-MMDD-XXXXX. The browser sends the one already in
--  the WhatsApp message. If it is malformed or taken, the function
--  makes a new one (up to 5 tries) and writes the customer's original
--  reference into rep_notes, so the rep can still match the chat.
--
--  The whatsapp_quotes Database Webhook (notify-event) still fires on
--  the header INSERT; since header and items now commit together, the
--  alert email always includes the items.
--
--  Safe to re-run.
-- ============================================================


-- 1. The reference must be unique --------------------------------------
-- whatsapp_quotes.id is normally the primary key already; add a unique
-- constraint only if neither exists.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = 'public.whatsapp_quotes'::regclass
      and c.contype in ('p', 'u')
      and a.attname = 'id'
      and array_length(c.conkey, 1) = 1
  ) then
    alter table public.whatsapp_quotes
      add constraint whatsapp_quotes_id_key unique (id);
  end if;
end;
$$;

-- An older format check on the id (VQ-…) would reject NAV-Q- refs.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.whatsapp_quotes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%VQ%'
  loop
    execute format('alter table public.whatsapp_quotes drop constraint %I', c.conname);
  end loop;
end;
$$;


-- 2. The function -------------------------------------------------------
create or replace function public.create_whatsapp_quote(p_quote jsonb, p_items jsonb)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  c_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  c_ref_re   constant text := '^NAV-Q-[0-9]{4}-[2-9A-HJ-NP-Z]{5}$';

  v_ref       text := upper(nullif(btrim(coalesce(p_quote ->> 'id', '')), ''));
  v_requested text := null;   -- set when we had to replace the customer's ref
  v_name      text := nullif(btrim(coalesce(p_quote ->> 'customer_name', '')), '');
  v_phone     text := nullif(btrim(coalesce(p_quote ->> 'customer_phone', '')), '');
  v_email     text := nullif(lower(btrim(coalesce(p_quote ->> 'customer_email', ''))), '');
  v_item      jsonb;
  v_items     jsonb := '[]'::jsonb;
  v_subtotal  numeric := 0;
  v_qty       numeric;
  v_price     numeric;
  v_sku       text;
  v_pname     text;
  v_image     text;
  v_attempt   int := 0;
begin
  -- ---- header ----------------------------------------------------------
  if jsonb_typeof(p_quote) is distinct from 'object' then
    raise exception 'Quote must be an object' using errcode = '22023';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 80 then
    raise exception 'Name must be 2–80 characters' using errcode = '22023';
  end if;
  -- Stored in the site's canonical form, e.g. 08031234567.
  if v_phone is null or v_phone !~ '^0[789][01][0-9]{8}$' then
    raise exception 'Phone must be a Nigerian mobile number like 08031234567' using errcode = '22023';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
    raise exception 'Email is not valid' using errcode = '22023';
  end if;

  -- ---- items -----------------------------------------------------------
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A quote needs at least one item' using errcode = '22023';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'A quote can have at most 50 items' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_sku   := nullif(btrim(coalesce(v_item ->> 'sku', '')), '');
    v_pname := nullif(btrim(coalesce(v_item ->> 'product_name', '')), '');
    v_image := nullif(btrim(coalesce(v_item ->> 'image', '')), '');

    if v_sku is null or char_length(v_sku) > 64 then
      raise exception 'Each item needs a SKU (max 64 characters)' using errcode = '22023';
    end if;
    if v_pname is null or char_length(v_pname) > 200 then
      raise exception 'Item % needs a name (max 200 characters)', v_sku using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'qty') is distinct from 'number' then
      raise exception 'Item % has no quantity', v_sku using errcode = '22023';
    end if;
    v_qty := (v_item ->> 'qty')::numeric;
    if v_qty <> trunc(v_qty) or v_qty not between 1 and 999 then
      raise exception 'Item % quantity must be a whole number from 1 to 999', v_sku using errcode = '22023';
    end if;
    if jsonb_typeof(v_item -> 'unit_price') is distinct from 'number' then
      raise exception 'Item % has no price', v_sku using errcode = '22023';
    end if;
    v_price := (v_item ->> 'unit_price')::numeric;
    if v_price < 0 or v_price > 100000000 then
      raise exception 'Item % price is out of range', v_sku using errcode = '22023';
    end if;
    if v_image is not null and char_length(v_image) > 2048 then
      v_image := null;
    end if;

    -- line_total is worked out here, not taken from the browser.
    v_items := v_items || jsonb_build_object(
      'sku', v_sku,
      'product_name', v_pname,
      'qty', v_qty,
      'unit_price', v_price,
      'line_total', v_qty * v_price,
      'image', v_image
    );
    v_subtotal := v_subtotal + v_qty * v_price;
  end loop;

  -- ---- reference -------------------------------------------------------
  if v_ref is null or v_ref !~ c_ref_re then
    v_requested := v_ref;
    v_ref := null;
  end if;

  loop
    if v_ref is null then
      v_ref := 'NAV-Q-' || to_char(now() at time zone 'Africa/Lagos', 'MMDD') || '-'
        || (select string_agg(substr(c_alphabet, 1 + floor(random() * 32)::int, 1), '')
            from generate_series(1, 5));
    end if;

    begin
      -- jsonb_populate_record lets Postgres cast customer_id to whatever
      -- type the column has (uuid or text).
      if v_requested is null then
        -- Normal case: the same columns the storefront has always
        -- inserted, so the existing anon INSERT rights cover it.
        insert into public.whatsapp_quotes
          (id, customer_id, customer_name, customer_phone, customer_email, subtotal, status)
        select v_ref, r.customer_id, v_name, v_phone, v_email, v_subtotal, 'new'
        from jsonb_populate_record(null::public.whatsapp_quotes,
          jsonb_build_object('customer_id', p_quote -> 'customer_id')) r;
      else
        -- The customer's WhatsApp message shows a different code: note
        -- it so the rep can match the chat. If anon may not write
        -- rep_notes, save without it (name + phone still match).
        begin
          insert into public.whatsapp_quotes
            (id, customer_id, customer_name, customer_phone, customer_email, subtotal, status, rep_notes)
          select v_ref, r.customer_id, v_name, v_phone, v_email, v_subtotal, 'new',
            format('Customer''s WhatsApp message shows reference %s; saved as %s.', v_requested, v_ref)
          from jsonb_populate_record(null::public.whatsapp_quotes,
            jsonb_build_object('customer_id', p_quote -> 'customer_id')) r;
        exception when insufficient_privilege then
          insert into public.whatsapp_quotes
            (id, customer_id, customer_name, customer_phone, customer_email, subtotal, status)
          select v_ref, r.customer_id, v_name, v_phone, v_email, v_subtotal, 'new'
          from jsonb_populate_record(null::public.whatsapp_quotes,
            jsonb_build_object('customer_id', p_quote -> 'customer_id')) r;
        end;
      end if;
      exit;   -- inserted
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 5 then
        raise;
      end if;
      v_requested := coalesce(v_requested, v_ref);
      v_ref := null;   -- try a fresh code
    end;
  end loop;

  insert into public.whatsapp_quote_items
    (quote_id, sku, product_name, qty, unit_price, line_total, image)
  select v_ref, r.sku, r.product_name, r.qty, r.unit_price, r.line_total, r.image
  from jsonb_populate_recordset(
    null::public.whatsapp_quote_items,
    (select jsonb_agg(e.value || jsonb_build_object('quote_id', v_ref)) from jsonb_array_elements(v_items) as e(value))
  ) r;

  return v_ref;
end;
$$;

comment on function public.create_whatsapp_quote(jsonb, jsonb) is
  'Send Cart to WhatsApp: validates and saves a quote header + items in one transaction; returns the reference saved.';

revoke all on function public.create_whatsapp_quote(jsonb, jsonb) from public;
grant execute on function public.create_whatsapp_quote(jsonb, jsonb) to anon, authenticated;


-- 3. Quick test (optional; run on its own, then delete the test row) ---
-- Note: if the whatsapp_quotes webhook is set up, this sends a real
-- "WhatsApp quote" alert email.
-- select public.create_whatsapp_quote(
--   '{"id":"NAV-Q-1107-TEST2","customer_name":"Test User","customer_phone":"08031234567"}',
--   '[{"sku":"TEST-SKU","product_name":"Test product","qty":1,"unit_price":1000}]'
-- );
-- delete from public.whatsapp_quote_items where quote_id = 'NAV-Q-1107-TEST2';
-- delete from public.whatsapp_quotes where id = 'NAV-Q-1107-TEST2';
