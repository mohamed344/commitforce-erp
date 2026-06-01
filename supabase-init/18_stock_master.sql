-- ─────────────────────────────────────────────────────────────
-- 18 · Stock master data (brands, units, warehouses) + item enrichment
--      + technical specifications. ERPNext-style Item master.
-- ─────────────────────────────────────────────────────────────

-- Brands -------------------------------------------------------
create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  name        text not null,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

-- Units of measure ---------------------------------------------
create table if not exists public.uoms (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  name        text not null,
  abbr        text,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

-- Warehouses (tree) --------------------------------------------
create table if not exists public.warehouses (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  parent_id   uuid references public.warehouses (id) on delete set null,
  name        text not null,
  is_group    boolean not null default false,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists brands_company_idx on public.brands (company_id);
create index if not exists uoms_company_idx on public.uoms (company_id);
create index if not exists warehouses_company_idx on public.warehouses (company_id);

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at before update on public.brands
  for each row execute function public.set_updated_at();
drop trigger if exists warehouses_set_updated_at on public.warehouses;
create trigger warehouses_set_updated_at before update on public.warehouses
  for each row execute function public.set_updated_at();

-- Item enrichment ----------------------------------------------
alter table public.items
  add column if not exists brand_id              uuid references public.brands (id) on delete set null,
  add column if not exists stock_uom_id          uuid references public.uoms (id) on delete set null,
  add column if not exists manufacturer          text,
  add column if not exists manufacturer_part_no  text,
  add column if not exists is_stock_item         boolean not null default true,
  add column if not exists has_batch_no          boolean not null default false,
  add column if not exists has_serial_no         boolean not null default false,
  add column if not exists valuation_rate        numeric(14,2) default 0,
  add column if not exists standard_selling_rate numeric(14,2),
  add column if not exists standard_buying_rate  numeric(14,2),
  add column if not exists weight_per_unit       numeric(14,3),
  add column if not exists weight_uom            text,
  add column if not exists barcode               text,
  add column if not exists image_url             text,
  add column if not exists shelf_life_days       int,
  add column if not exists reorder_level         numeric(14,2),
  add column if not exists reorder_qty           numeric(14,2),
  add column if not exists min_order_qty         numeric(14,2),
  add column if not exists opening_stock         numeric(14,2);

create index if not exists items_brand_idx on public.items (brand_id);

-- Technical specifications (free-form) -------------------------
create table if not exists public.item_specs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  item_id     uuid not null references public.items (id) on delete cascade,
  label       text not null,                 -- e.g. "Power", "Voltage"
  value       text,                          -- e.g. "132KW", "400V"
  sort_order  int not null default 0
);

create index if not exists item_specs_item_idx on public.item_specs (item_id);

-- RLS ----------------------------------------------------------
alter table public.brands       enable row level security;
alter table public.uoms         enable row level security;
alter table public.warehouses   enable row level security;
alter table public.item_specs   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['brands','uoms','warehouses','item_specs'] loop
    execute format('drop policy if exists %I on public.%I', t || '_company_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (company_id = public.current_company_id())
         with check (company_id = public.current_company_id())',
      t || '_company_rw', t);
  end loop;
end $$;
