-- ─────────────────────────────────────────────────────────────
-- 04 · Modules registry (the ERP "workspace launcher" catalog)
--
-- Mirrors config/modules.ts. The app currently reads enable/disable
-- from env (NEXT_PUBLIC_MODULE_*); this table is the canonical catalog
-- and the future source of truth if module toggles move to the DB.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.modules (
  key              text primary key,   -- 'stock', 'sales', 'crm', ...
  name             text not null,       -- default (English) display name
  icon             text,                -- icon identifier
  sort_order       int  not null default 0,
  default_enabled  boolean not null default false
);

comment on table public.modules is 'Catalog of ERP modules shown on the launcher.';

alter table public.modules enable row level security;

-- Per-organization enable/disable (future runtime toggles).
create table if not exists public.org_modules (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  module_key  text not null references public.modules (key) on delete cascade,
  enabled     boolean not null default false,
  primary key (org_id, module_key)
);

alter table public.org_modules enable row level security;
