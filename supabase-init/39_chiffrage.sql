-- ─────────────────────────────────────────────────────────────
-- 39 · CRM chiffrage (cost-estimation) pipeline
--
-- Adds the two-level estimation structure on top of the CRM project
-- detail (migration 37):
--   • project_qte_lines  — level 1, the QTE (devis quantitatif) lines
--     extracted from the C.D.C (manually, by CSV import, or by AI/OCR).
--   • project_material_lines (from 37) gains a qte_line_id so each QTE
--     line owns its detailed materials list (level 2).
--   • project_labor_lines — the prestations (labor) table: days × daily_rate.
--   • projects gains margin_pct + transport_amount — the whole-estimate footer.
--   • project_estimates — saved snapshots of a finished chiffrage détaillé.
--
-- Missing-price items are resolved inline in the CRM (fiche de consultation),
-- writing back to items.standard_buying_rate — no coupling to the purchase_orders
-- module. The final output is a printable devis + a project_estimates snapshot.
--
-- Run this in the SQL editor of project xrjkckpchaanapyhyrbt. It assumes 01-38
-- already exist. Every statement is idempotent, so re-running is safe.
-- ─────────────────────────────────────────────────────────────

-- ── project_qte_lines — level 1: the QTE (quantitative estimate) ──
create table if not exists public.project_qte_lines (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  line_no      int  not null default 0,
  designation  text not null,                                   -- the QTE line label
  qty          numeric(14,3) not null default 0,
  uom          text,
  notes        text,
  sort_order   int  not null default 0,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists project_qte_lines_project_idx on public.project_qte_lines (project_id);

drop trigger if exists project_qte_lines_set_updated_at on public.project_qte_lines;
create trigger project_qte_lines_set_updated_at
  before update on public.project_qte_lines
  for each row execute function public.set_updated_at();

alter table public.project_qte_lines enable row level security;
drop policy if exists "project_qte_lines_company_rw" on public.project_qte_lines;
create policy "project_qte_lines_company_rw" on public.project_qte_lines
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- ── project_material_lines (level 2) — attach to its QTE line ──
-- Nullable: pre-existing flat imports keep qte_line_id = null and still load.
alter table public.project_material_lines
  add column if not exists qte_line_id uuid references public.project_qte_lines (id) on delete cascade;
create index if not exists project_material_lines_qte_idx on public.project_material_lines (qte_line_id);

-- ── project_labor_lines — prestations (labor): days × daily_rate ──
create table if not exists public.project_labor_lines (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  line_no      int  not null default 0,
  description  text not null,
  days         numeric(14,2) not null default 0,
  daily_rate   numeric(14,2) not null default 0,
  amount       numeric(14,2) generated always as (round(days * daily_rate, 2)) stored,
  sort_order   int  not null default 0,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists project_labor_lines_project_idx on public.project_labor_lines (project_id);

alter table public.project_labor_lines enable row level security;
drop policy if exists "project_labor_lines_company_rw" on public.project_labor_lines;
create policy "project_labor_lines_company_rw" on public.project_labor_lines
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- ── projects — whole-estimate footer values ──
alter table public.projects add column if not exists margin_pct       numeric(5,2)  default 0;
alter table public.projects add column if not exists transport_amount numeric(14,2) default 0;

-- ── project_estimates — saved chiffrage snapshots ──
create table if not exists public.project_estimates (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  project_id       uuid not null references public.projects (id) on delete cascade,
  estimate_no      text,
  materials_total  numeric(14,2) not null default 0,
  labor_total      numeric(14,2) not null default 0,
  margin_pct       numeric(5,2)  not null default 0,
  margin_amount    numeric(14,2) not null default 0,
  transport_amount numeric(14,2) not null default 0,
  grand_total      numeric(14,2) not null default 0,
  currency         text,
  snapshot         jsonb,                                       -- frozen QTE + materials + labor at save time
  notes            text,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists project_estimates_project_idx on public.project_estimates (project_id);

alter table public.project_estimates enable row level security;
drop policy if exists "project_estimates_company_rw" on public.project_estimates;
create policy "project_estimates_company_rw" on public.project_estimates
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
