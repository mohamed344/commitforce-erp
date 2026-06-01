-- ─────────────────────────────────────────────────────────────
-- 28 · Custom, per-company roles
--
-- The built-in `roles` table (migration 03) is a GLOBAL catalog (key is a
-- bare PK, no company_id, read-only RLS) and the admin/member tier in
-- `profiles.role` drives `isAdmin`. We deliberately do NOT open that catalog
-- for writes — instead admins create company-scoped organizational roles here
-- (job titles / teams) and assign them to employees and members. These are
-- labels layered on top of the admin/member access tier, not a new permission
-- system.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.company_roles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  key         text not null,                          -- slug, unique within the company
  label       text not null,
  description text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, key)
);

create index if not exists company_roles_company_idx on public.company_roles (company_id);

-- Optional organizational role on a membership (kept alongside the role_key tier).
alter table public.user_roles
  add column if not exists company_role_id uuid references public.company_roles (id) on delete set null;

drop trigger if exists company_roles_set_updated_at on public.company_roles;
create trigger company_roles_set_updated_at before update on public.company_roles
  for each row execute function public.set_updated_at();

alter table public.company_roles enable row level security;

-- Members read (role labels appear in dropdowns / employee records).
drop policy if exists "company_roles_select_member" on public.company_roles;
create policy "company_roles_select_member" on public.company_roles
  for select using (public.is_company_member(company_id));

-- Only admins create / edit / delete them (configuration).
drop policy if exists "company_roles_manage_admin" on public.company_roles;
create policy "company_roles_manage_admin" on public.company_roles
  for all
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));
