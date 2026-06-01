-- ─────────────────────────────────────────────────────────────
-- 15 · CRM leads (pipeline) — enterprise-scoped
--
-- Drives the CRM Kanban: columns = stage
-- (new → contacted → qualified → won → lost).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  title         text not null,
  contact_name  text,
  email         text,
  phone         text,
  value         numeric(14,2),
  stage         text not null default 'new'
                check (stage in ('new','contacted','qualified','won','lost')),
  notes         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists leads_company_idx on public.leads (company_id);
create index if not exists leads_stage_idx on public.leads (stage);

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

drop policy if exists "leads_company_rw" on public.leads;
create policy "leads_company_rw" on public.leads
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
