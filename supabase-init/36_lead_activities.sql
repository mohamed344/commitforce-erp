-- ─────────────────────────────────────────────────────────────
-- 36 · CRM lead activity timeline (calls / meetings / emails / notes)
--
-- Per-lead history shown on the lead detail page. Commercials log each call
-- (and meeting / email / note) with a free-text description and a date/time,
-- attributed to whoever logged it. Stage changes are recorded automatically
-- by a trigger on `leads`, so the timeline shows the full history in one place.
--
-- PREREQUISITES: this migration sits on top of 01–35 (it references
-- public.companies, public.leads, public.profiles and the helpers
-- current_company_id() / set_updated_at()). Apply the numbered files in order.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.lead_activities (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  lead_id       uuid not null references public.leads (id) on delete cascade,
  activity_type text not null default 'call'
                check (activity_type in ('call','meeting','email','note','stage_change')),
  description   text,
  from_stage    text,            -- set only for stage_change rows
  to_stage      text,            -- set only for stage_change rows
  occurred_at   timestamptz not null default now(),
  -- FK to profiles so PostgREST can embed author:profiles(full_name).
  -- profiles.id == auth.users.id (1:1), so auth.uid() is a valid profile id.
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id);
create index if not exists lead_activities_company_idx on public.lead_activities (company_id);

-- ── Auto-log stage changes into the timeline ───────────────────
-- Fires for board drags and detail-page edits alike. security definer so the
-- insert runs with the trigger owner's rights; company_id is set explicitly.
create or replace function public.log_lead_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.lead_activities (company_id, lead_id, activity_type, from_stage, to_stage, created_by)
  values (new.company_id, new.id, 'stage_change', old.stage, new.stage, auth.uid());
  return new;
end;
$$;

drop trigger if exists leads_log_stage_change on public.leads;
create trigger leads_log_stage_change
  after update on public.leads
  for each row when (new.stage is distinct from old.stage)
  execute function public.log_lead_stage_change();

-- ── updated_at + RLS (mirrors the pattern in 25_partners.sql) ───
drop trigger if exists lead_activities_set_updated_at on public.lead_activities;
create trigger lead_activities_set_updated_at
  before update on public.lead_activities
  for each row execute function public.set_updated_at();

alter table public.lead_activities enable row level security;
drop policy if exists "lead_activities_company_rw" on public.lead_activities;
create policy "lead_activities_company_rw" on public.lead_activities
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
