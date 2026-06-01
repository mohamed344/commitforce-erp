-- ─────────────────────────────────────────────────────────────
-- 09 · Item attributes ("caractéristiques") + their allowed values
--
-- ERPNext "Item Attribute" model: reusable characteristics such as
-- Color or Size, each with a set of allowed values (Red, Blue / S, M, L).
-- Templates declare which attributes they vary on; variants pick one
-- value per attribute (see 10_items.sql).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.item_attributes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  name        text not null,                 -- e.g. "Color", "Size"
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, name)
);

create index if not exists item_attributes_org_idx on public.item_attributes (org_id);

create table if not exists public.item_attribute_values (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  attribute_id  uuid not null references public.item_attributes (id) on delete cascade,
  value         text not null,               -- e.g. "Red", "M"
  sort_order    int not null default 0,
  unique (attribute_id, value)
);

create index if not exists item_attribute_values_attr_idx on public.item_attribute_values (attribute_id);

drop trigger if exists item_attributes_set_updated_at on public.item_attributes;
create trigger item_attributes_set_updated_at
  before update on public.item_attributes
  for each row execute function public.set_updated_at();

alter table public.item_attributes enable row level security;
alter table public.item_attribute_values enable row level security;
