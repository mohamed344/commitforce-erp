-- ─────────────────────────────────────────────────────────────
-- 24 · Per-company domain option lists (statuses / stages / types)
--
-- Makes the ERP's domain enums user-configurable per company. The app
-- ships code defaults (see lib/options.ts) and these rows OVERRIDE them
-- per set_key — exactly the fallback pattern used by company_settings (23).
-- When a company has no rows for a set, the app uses the code defaults, so
-- this migration is safe to apply at any time and the app works without it.
--
-- set_key values:
--   'crm_stage'         (CRM lead pipeline)       — fully customizable
--   'project_status'    (project status)          — fully customizable
--   'stock_entry_type'  (stock movement type)     — relabel/recolor only*
--   'item_type'         (template/variant)        — relabel/recolor only*
-- * those keys drive business logic (ledger sign / variant generation),
--   so their CHECK constraints below are intentionally kept.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.domain_options (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id()
                references public.companies (id) on delete cascade,
  set_key     text not null,
  key         text not null,            -- machine value stored on leads.stage / projects.status …
  label       text not null,            -- single display text (language-neutral)
  tone        text,                     -- Badge tone (gray/green/blue/amber/red/violet)
  sort_order  int  not null default 0,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, set_key, key)
);

comment on table public.domain_options is
  'Per-company overrides for domain option lists (CRM stages, project statuses, …). No rows for a set = use code defaults.';

create index if not exists domain_options_company_set_idx
  on public.domain_options (company_id, set_key, sort_order);

alter table public.domain_options enable row level security;

-- Members read (the lists drive every user's pipeline / dropdowns).
drop policy if exists "domain_options_select_member" on public.domain_options;
create policy "domain_options_select_member" on public.domain_options
  for select using (public.is_company_member(company_id));

-- Only admins manage them (configuration).
drop policy if exists "domain_options_manage_admin" on public.domain_options;
create policy "domain_options_manage_admin" on public.domain_options
  for all
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));

-- Keep updated_at fresh (reuse the shared trigger fn used by leads/projects).
drop trigger if exists domain_options_set_updated_at on public.domain_options;
create trigger domain_options_set_updated_at
  before update on public.domain_options
  for each row execute function public.set_updated_at();

-- Relax the CHECK constraints on the FULLY-customizable sets so custom
-- stage/status values are accepted. (stock_entries / items CHECKs are kept.)
alter table public.leads    drop constraint if exists leads_stage_check;
alter table public.projects drop constraint if exists projects_status_check;
