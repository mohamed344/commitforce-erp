-- ─────────────────────────────────────────────────────────────
-- 19 · Stock movements: Stock Entries → signed Stock Ledger → balances
-- ─────────────────────────────────────────────────────────────

-- Stock Entry (header) -----------------------------------------
create table if not exists public.stock_entries (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  entry_type  text not null check (entry_type in ('receipt','issue','transfer','adjustment')),
  posting_date date not null default current_date,
  project_id  uuid references public.projects (id) on delete set null,
  reference   text,
  notes       text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Stock Entry lines --------------------------------------------
create table if not exists public.stock_entry_lines (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  stock_entry_id      uuid not null references public.stock_entries (id) on delete cascade,
  item_id             uuid not null references public.items (id) on delete restrict,
  qty                 numeric(14,3) not null check (qty > 0),
  rate                numeric(14,2),
  source_warehouse_id uuid references public.warehouses (id) on delete set null,
  target_warehouse_id uuid references public.warehouses (id) on delete set null,
  batch_id            uuid,
  serial_no_id        uuid
);

-- Stock Ledger (immutable, signed) -----------------------------
create table if not exists public.stock_ledger_entries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  item_id         uuid not null references public.items (id) on delete cascade,
  warehouse_id    uuid not null references public.warehouses (id) on delete cascade,
  qty_change      numeric(14,3) not null,
  rate            numeric(14,2),
  posting_date    date not null default current_date,
  stock_entry_id  uuid references public.stock_entries (id) on delete cascade,
  line_id         uuid references public.stock_entry_lines (id) on delete cascade,
  created_at      timestamptz not null default now()
);

create index if not exists sle_item_wh_idx on public.stock_ledger_entries (item_id, warehouse_id);
create index if not exists stock_entry_lines_entry_idx on public.stock_entry_lines (stock_entry_id);

drop trigger if exists stock_entries_set_updated_at on public.stock_entries;
create trigger stock_entries_set_updated_at before update on public.stock_entries
  for each row execute function public.set_updated_at();

-- Post each line into the ledger based on the parent entry_type.
create or replace function public.post_stock_entry_line()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_company uuid;
  v_date date;
begin
  select entry_type, company_id, posting_date
    into v_type, v_company, v_date
    from public.stock_entries where id = new.stock_entry_id;

  -- inbound (+) at target
  if v_type in ('receipt','transfer','adjustment') and new.target_warehouse_id is not null then
    insert into public.stock_ledger_entries (company_id, item_id, warehouse_id, qty_change, rate, posting_date, stock_entry_id, line_id)
    values (v_company, new.item_id, new.target_warehouse_id, new.qty, new.rate, v_date, new.stock_entry_id, new.id);
  end if;

  -- outbound (-) at source
  if v_type in ('issue','transfer') and new.source_warehouse_id is not null then
    insert into public.stock_ledger_entries (company_id, item_id, warehouse_id, qty_change, rate, posting_date, stock_entry_id, line_id)
    values (v_company, new.item_id, new.source_warehouse_id, -new.qty, new.rate, v_date, new.stock_entry_id, new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists post_stock_entry_line_trg on public.stock_entry_lines;
create trigger post_stock_entry_line_trg
  after insert on public.stock_entry_lines
  for each row execute function public.post_stock_entry_line();

-- Current quantity on hand per item × warehouse.
create or replace view public.stock_balances
with (security_invoker = true) as
  select company_id, item_id, warehouse_id, sum(qty_change) as qty
  from public.stock_ledger_entries
  group by company_id, item_id, warehouse_id;

-- RLS ----------------------------------------------------------
alter table public.stock_entries        enable row level security;
alter table public.stock_entry_lines    enable row level security;
alter table public.stock_ledger_entries enable row level security;

do $$
declare t text;
begin
  foreach t in array array['stock_entries','stock_entry_lines','stock_ledger_entries'] loop
    execute format('drop policy if exists %I on public.%I', t || '_company_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (company_id = public.current_company_id())
         with check (company_id = public.current_company_id())',
      t || '_company_rw', t);
  end loop;
end $$;
