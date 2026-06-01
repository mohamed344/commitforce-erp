-- ─────────────────────────────────────────────────────────────
-- 01 · Organizations (tenants / enterprises)
-- ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  email       text,
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.organizations is 'Tenants / enterprises using the ERP.';

alter table public.organizations enable row level security;
