-- ─────────────────────────────────────────────────────────────
-- 37 · CRM project pipeline — client details, advancement timeline, Excel BOQ
--
-- Turns the CRM module into a PROJECT pipeline (it used to create leads/clients).
-- A "lead" is now a project: it carries the client's contact details and a daily
-- rate, moves through the configurable pipeline stages from lib/options.ts
-- (project_status, default 'nouveau'), and gets a step-by-step advancement
-- timeline — some entries logged manually, some auto (stage changes, material
-- imports). After creation an engineer uploads an Excel list of needed items;
-- the app matches each line to stock and stores the result in
-- project_material_lines (price + on-hand qty + an in_stock/insufficient/not_found
-- flag). Mirrors the lead_activities pattern from migration 36.
--
-- Run this in the SQL editor of project xrjkckpchaanapyhyrbt (the one in your
-- app's .env.local). It assumes 01-36 already exist. Every statement is
-- idempotent, so re-running is safe.
-- ─────────────────────────────────────────────────────────────

-- ── projects: client details + daily rate ─────────────────────
alter table public.projects add column if not exists client_name    text;
alter table public.projects add column if not exists client_email    text;
alter table public.projects add column if not exists client_phone    text;
alter table public.projects add column if not exists client_address  text;
alter table public.projects add column if not exists daily_rate      numeric(14,2);

-- Pipeline stages are driven by domain_options now (project_status). Drop the
-- hard-coded status whitelist from migration 07 so any configured key — like
-- 'nouveau' — is accepted. Done by introspection so the constraint's real name
-- doesn't matter.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public' and rel.relname = 'projects'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.projects drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.projects alter column status set default 'nouveau';

-- Migrate any projects still on the legacy statuses (migration 07) onto the new
-- pipeline so they show up in the CRM board. Runs BEFORE the stage-change
-- trigger below exists, so it doesn't spam the timeline. Idempotent: only the
-- five legacy keys are touched, so re-running this file is a no-op afterwards.
update public.projects set status = case status
  when 'planning'  then 'nouveau'
  when 'active'    then 'en_cours'
  when 'on_hold'   then 'nouveau'
  when 'completed' then 'termine'
  when 'cancelled' then 'perdu'
  else status end
where status in ('planning','active','on_hold','completed','cancelled');

-- ── project_activities — advancement timeline (manual + auto) ──
create table if not exists public.project_activities (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  activity_type text not null default 'note'
                check (activity_type in ('call','meeting','email','note','milestone','stage_change','materials_imported')),
  description   text,
  from_stage    text,                                            -- stage_change only
  to_stage      text,                                            -- stage_change only
  occurred_at   timestamptz not null default now(),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists project_activities_project_idx on public.project_activities (project_id);
create index if not exists project_activities_company_idx on public.project_activities (company_id);

-- Auto-log status (stage) changes, exactly like leads (migration 36).
create or replace function public.log_project_stage_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into public.project_activities (company_id, project_id, activity_type, from_stage, to_stage, created_by)
    values (new.company_id, new.id, 'stage_change', old.status, new.status, auth.uid());
  end if;
  return new;
end $$;

drop trigger if exists projects_log_stage_change on public.projects;
create trigger projects_log_stage_change
  after update on public.projects
  for each row execute function public.log_project_stage_change();

drop trigger if exists project_activities_set_updated_at on public.project_activities;
create trigger project_activities_set_updated_at
  before update on public.project_activities
  for each row execute function public.set_updated_at();

alter table public.project_activities enable row level security;
drop policy if exists "project_activities_company_rw" on public.project_activities;
create policy "project_activities_company_rw" on public.project_activities
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- ── project_material_lines — engineer's Excel BOQ vs stock ─────
-- One row per line of the uploaded Excel. The app matches each line to an item
-- (by reference/SKU, then by name) and snapshots the on-hand qty + unit price at
-- import time. status: in_stock (enough on hand) | insufficient (some, not enough)
-- | not_found (no matching stock item).
create table if not exists public.project_material_lines (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  project_id      uuid not null references public.projects (id) on delete cascade,
  line_no         int  not null default 0,
  raw_name        text not null,                                 -- designation as typed in the Excel
  raw_ref         text,                                          -- reference / SKU as typed in the Excel
  uom             text,
  qty             numeric(14,3) not null default 0,
  matched_item_id uuid references public.items (id) on delete set null,
  unit_rate       numeric(14,2),                                 -- buying/valuation rate at import
  in_stock_qty    numeric(14,3),                                 -- on-hand across warehouses at import
  status          text not null default 'not_found'
                  check (status in ('in_stock','insufficient','not_found')),
  notes           text,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists project_material_lines_project_idx on public.project_material_lines (project_id);

alter table public.project_material_lines enable row level security;
drop policy if exists "project_material_lines_company_rw" on public.project_material_lines;
create policy "project_material_lines_company_rw" on public.project_material_lines
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
