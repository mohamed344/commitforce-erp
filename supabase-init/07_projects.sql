-- ─────────────────────────────────────────────────────────────
-- 07 · Projects (enterprise-scoped)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,
  code        text,
  description text,
  status      text not null default 'active'
              check (status in ('planning','active','on_hold','completed','cancelled')),
  start_date  date,
  end_date    date,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, code)
);

create index if not exists projects_org_idx on public.projects (org_id);

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
