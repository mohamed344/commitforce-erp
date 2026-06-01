-- ─────────────────────────────────────────────────────────────
-- 08 · Categories (Item Groups — enterprise-scoped, optionally a tree)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  parent_id   uuid references public.categories (id) on delete set null,
  name        text not null,
  description text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, name)
);

create index if not exists categories_org_idx on public.categories (org_id);
create index if not exists categories_parent_idx on public.categories (parent_id);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
