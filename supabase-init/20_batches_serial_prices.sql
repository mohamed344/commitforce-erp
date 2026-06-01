-- ─────────────────────────────────────────────────────────────
-- 20 · Batches, serial numbers, price lists & item prices
-- ─────────────────────────────────────────────────────────────

create table if not exists public.batches (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  item_id            uuid not null references public.items (id) on delete cascade,
  batch_no           text not null,
  expiry_date        date,
  manufacturing_date date,
  created_at         timestamptz not null default now(),
  unique (company_id, item_id, batch_no)
);

create table if not exists public.serial_nos (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  item_id       uuid not null references public.items (id) on delete cascade,
  serial_no     text not null,
  warehouse_id  uuid references public.warehouses (id) on delete set null,
  status        text not null default 'active' check (status in ('active','delivered','inactive')),
  created_at    timestamptz not null default now(),
  unique (company_id, serial_no)
);

create table if not exists public.price_lists (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  name        text not null,
  currency    text not null default 'DZD',
  selling     boolean not null default true,
  buying      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.item_prices (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  item_id        uuid not null references public.items (id) on delete cascade,
  price_list_id  uuid not null references public.price_lists (id) on delete cascade,
  rate           numeric(14,2) not null,
  min_qty        numeric(14,2) not null default 0,
  created_at     timestamptz not null default now(),
  unique (company_id, item_id, price_list_id, min_qty)
);

create index if not exists batches_item_idx on public.batches (item_id);
create index if not exists serial_nos_item_idx on public.serial_nos (item_id);
create index if not exists item_prices_item_idx on public.item_prices (item_id);

-- Late FKs from stock_entry_lines (created in 19 without these refs).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'stock_entry_lines_batch_fk') then
    alter table public.stock_entry_lines
      add constraint stock_entry_lines_batch_fk foreign key (batch_id) references public.batches (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stock_entry_lines_serial_fk') then
    alter table public.stock_entry_lines
      add constraint stock_entry_lines_serial_fk foreign key (serial_no_id) references public.serial_nos (id) on delete set null;
  end if;
end $$;

-- RLS ----------------------------------------------------------
alter table public.batches      enable row level security;
alter table public.serial_nos   enable row level security;
alter table public.price_lists  enable row level security;
alter table public.item_prices  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['batches','serial_nos','price_lists','item_prices'] loop
    execute format('drop policy if exists %I on public.%I', t || '_company_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (company_id = public.current_company_id())
         with check (company_id = public.current_company_id())',
      t || '_company_rw', t);
  end loop;
end $$;
