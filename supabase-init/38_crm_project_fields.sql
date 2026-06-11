-- ─────────────────────────────────────────────────────────────
-- 38 · CRM project — rich creation fields
--
-- Extends `projects` with the fields an electrical-contracting project needs at
-- creation: a link to the customer (clients master, migration 25), a project
-- manager (employees, migration 29), a project type + priority (configurable via
-- domain_options — see lib/options.ts), an estimated budget + currency, a work
-- site address, a deadline and payment terms. All nullable; new columns inherit
-- the existing company-scoped RLS policy on `projects` (no policy change needed).
--
-- Run AFTER 37_crm_projects.sql, in the SQL editor of project xrjkckpchaanapyhyrbt
-- (the one in your app's .env.local). Every statement is idempotent.
-- ─────────────────────────────────────────────────────────────

alter table public.projects add column if not exists customer_id        uuid references public.customers (id) on delete set null;
alter table public.projects add column if not exists project_manager_id uuid references public.employees (id) on delete set null;
alter table public.projects add column if not exists project_type       text;
alter table public.projects add column if not exists priority           text default 'normal';
alter table public.projects add column if not exists budget_amount      numeric(14,2);
alter table public.projects add column if not exists currency           text;
alter table public.projects add column if not exists site_address       text;
alter table public.projects add column if not exists deadline           date;
alter table public.projects add column if not exists payment_terms      text;

create index if not exists projects_customer_idx on public.projects (customer_id);
