-- ─────────────────────────────────────────────────────────────
-- 29 · Employees (HR)
--
-- Standalone HR records for the company. An employee may optionally be linked
-- to an app login (profiles.id) and to a company role (migration 28), but a
-- record can exist without either (e.g. staff with no system access).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  full_name       text not null,
  position        text,
  department      text,
  hire_date       date,
  phone           text,
  email           text,
  status          text not null default 'active',                                  -- active | on_leave | terminated
  user_id         uuid references public.profiles (id) on delete set null,
  company_role_id uuid references public.company_roles (id) on delete set null,
  notes           text,
  created_by      uuid default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists employees_company_idx on public.employees (company_id);
create index if not exists employees_user_idx on public.employees (user_id);

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

alter table public.employees enable row level security;

drop policy if exists "employees_company_rw" on public.employees;
create policy "employees_company_rw" on public.employees
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
