-- ============================================================
-- Site-wide appearance settings (theme + font pair) — single row,
-- read by every visitor on load, written only by the admin.
-- Run this once in the Supabase SQL Editor, same as schema.sql.
-- ============================================================

create table if not exists site_settings (
  id smallint primary key default 1 check (id = 1), -- enforces exactly one row
  theme text not null default 'navy' check (theme in ('navy', 'green', 'purple')),
  font_pair text not null default 'default' check (font_pair in ('default', 'playful')),
  updated_at timestamptz not null default now()
);

drop trigger if exists site_settings_set_updated_at on site_settings;
create trigger site_settings_set_updated_at
  before update on site_settings
  for each row execute function set_updated_at(); -- reuses the function from schema.sql

insert into site_settings (id, theme, font_pair)
values (1, 'navy', 'default')
on conflict (id) do nothing;

alter table site_settings enable row level security;

create policy "public read site_settings" on site_settings for select using (true);
create policy "admin write site_settings" on site_settings for update
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
