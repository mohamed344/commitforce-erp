-- ─────────────────────────────────────────────────────────────
-- 22 · Project bill of materials — products + quantities per project
-- ─────────────────────────────────────────────────────────────
create table if not exists public.project_items (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  project_id  uuid not null references public.projects (id) on delete cascade,
  item_id     uuid not null references public.items (id) on delete restrict,
  qty         numeric(14,3) not null default 1,
  rate        numeric(14,2),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (project_id, item_id)
);

create index if not exists project_items_project_idx on public.project_items (project_id);

alter table public.project_items enable row level security;

drop policy if exists "project_items_company_rw" on public.project_items;
create policy "project_items_company_rw" on public.project_items
  for all to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Demo: attach a few items to one project of the active company (idempotent).
do $$
declare cid uuid; pid uuid;
begin
  select p.company_id into cid from public.profiles p join auth.users u on u.id = p.id
    where u.email = 'mohamedbfrbrm@gmail.com';
  if cid is null then return; end if;
  if exists (select 1 from public.project_items where company_id = cid) then return; end if;

  select id into pid from public.projects where company_id = cid order by code nulls last, created_at limit 1;
  if pid is null then return; end if;

  insert into public.project_items (company_id, project_id, item_id, qty, rate)
  select cid, pid, i.id, q.qty, i.standard_buying_rate
  from (values ('DISJ-132', 4::numeric), ('CAB-R2V-4X16', 150), ('CONT-LC1D40', 8), ('COF-IP55', 2)) as q(sku, qty)
  join public.items i on i.company_id = cid and i.sku = q.sku;
end $$;
