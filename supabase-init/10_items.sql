-- ─────────────────────────────────────────────────────────────
-- 10 · Items — two types: Template and Variant (ERPNext model)
--
--   • Template: item_type='template', template_id IS NULL.
--               Declares the attributes it varies on (template_attributes).
--   • Variant:  item_type='variant',  template_id -> the template item.
--               Pins one value per template attribute (item_variant_attributes).
-- ─────────────────────────────────────────────────────────────
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  item_type    text not null check (item_type in ('template','variant')),
  template_id  uuid references public.items (id) on delete cascade,
  name         text not null,
  sku          text,
  category_id  uuid references public.categories (id) on delete set null,
  project_id   uuid references public.projects (id) on delete set null,
  description  text,
  uom          text not null default 'Unit',
  is_active    boolean not null default true,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (org_id, sku),
  -- a variant must reference a template; a template must not.
  constraint items_type_template_chk check (
    (item_type = 'variant'  and template_id is not null) or
    (item_type = 'template' and template_id is null)
  )
);

create index if not exists items_org_idx on public.items (org_id);
create index if not exists items_template_idx on public.items (template_id);
create index if not exists items_category_idx on public.items (category_id);
create index if not exists items_project_idx on public.items (project_id);

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

alter table public.items enable row level security;

-- Attributes a TEMPLATE varies on (e.g. T-Shirt varies on Color, Size).
create table if not exists public.template_attributes (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  item_id       uuid not null references public.items (id) on delete cascade,          -- the template
  attribute_id  uuid not null references public.item_attributes (id) on delete cascade,
  unique (item_id, attribute_id)
);

create index if not exists template_attributes_item_idx on public.template_attributes (item_id);

-- The attribute values that define a VARIANT (e.g. Color=Red, Size=M).
create table if not exists public.item_variant_attributes (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizations (id) on delete cascade,
  item_id             uuid not null references public.items (id) on delete cascade,                -- the variant
  attribute_id        uuid not null references public.item_attributes (id) on delete cascade,
  attribute_value_id  uuid not null references public.item_attribute_values (id) on delete cascade,
  unique (item_id, attribute_id)
);

create index if not exists item_variant_attributes_item_idx on public.item_variant_attributes (item_id);

alter table public.template_attributes enable row level security;
alter table public.item_variant_attributes enable row level security;
