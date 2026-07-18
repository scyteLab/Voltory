-- ============================================================
-- Voltory admin backend — Phase 1 schema.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).
--
-- Mirrors the shape already used by src/data/products.js so the
-- eventual storefront swap-over needs no reshaping, only a new
-- data source.
-- ============================================================

create table if not exists categories (
  id text primary key,
  label text not null,
  icon text,
  blurb text,
  filter_config jsonb not null default '[]',
  hot boolean not null default false,
  megamenu jsonb not null default '[]'
);

create table if not exists brands (
  id text primary key,
  name text not null,
  logo text
);

create table if not exists products (
  sku text primary key,
  slug text not null unique,
  name text not null,
  brand text not null,
  model text,
  category text not null references categories(id),
  image text,
  price integer not null,
  was integer,
  stock integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  rating numeric(2,1),
  reviews integer default 0,
  questions integer default 0,
  badge text,
  icon text,
  tags jsonb not null default '[]',
  hp numeric(3,1),
  inverter boolean,
  litres integer,
  doors integer,
  highlights jsonb not null default '[]',
  specs jsonb not null default '[]',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on every edit.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- ---- Row Level Security -------------------------------------
-- Public (anon key) can read everything — the storefront will use
-- this once it switches over. Only a signed-in admin can write.

alter table categories enable row level security;
alter table brands enable row level security;
alter table products enable row level security;

create policy "public read categories" on categories for select using (true);
create policy "public read brands" on brands for select using (true);
create policy "public read products" on products for select using (true);

create policy "admin write categories" on categories for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write brands" on brands for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "admin write products" on products for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
