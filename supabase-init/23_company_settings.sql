-- ─────────────────────────────────────────────────────────────
-- 23 · Per-company settings (runtime branding / localization)
--
-- Moves the branding values that used to live only in NEXT_PUBLIC_*
-- env vars (see lib/config.ts) into the database so admins can change
-- them at runtime from the Settings page. Every column is nullable —
-- a NULL means "fall back to the env default" (handled in lib/settings.ts).
--
-- Module on/off toggles are NOT stored here; they reuse the existing
-- public.company_modules table (04_modules.sql), which already has
-- admin-only write + member-read RLS.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.company_settings (
  company_id        uuid primary key
                      references public.companies (id) on delete cascade
                      default public.current_company_id(),

  -- Branding & theme
  brand_color       text,
  brand_color_dark  text,
  font_family       text,

  -- Identity & logo
  app_name          text,
  enterprise_name   text,
  enterprise_short  text,
  enterprise_email  text,
  logo_url          text,

  -- Localization
  default_locale    text,
  default_currency  text,

  updated_at        timestamptz not null default now()
);

comment on table public.company_settings is
  'Per-company runtime overrides for branding/localization. NULL column = use the env default.';

alter table public.company_settings enable row level security;

-- Members of the company can read its settings (needed to theme the shell).
drop policy if exists "company_settings_select_member" on public.company_settings;
create policy "company_settings_select_member" on public.company_settings
  for select using (public.is_company_member(company_id));

-- Only admins may create/update their company's settings.
drop policy if exists "company_settings_manage_admin" on public.company_settings;
create policy "company_settings_manage_admin" on public.company_settings
  for all
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

-- Keep updated_at fresh on every write.
create or replace function public.touch_company_settings()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists company_settings_touch on public.company_settings;
create trigger company_settings_touch
  before update on public.company_settings
  for each row execute function public.touch_company_settings();
