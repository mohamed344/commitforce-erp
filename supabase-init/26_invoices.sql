-- ─────────────────────────────────────────────────────────────
-- 26 · Factures — sales & purchase invoices, lines, numbering, totals,
--      and stock posting on validation.
--
-- A sales invoice (facture de vente) ISSUES stock out of a warehouse; a
-- purchase invoice (facture d'achat) RECEIVES stock into a warehouse. Both
-- reuse the existing signed ledger: validating an invoice inserts a
-- stock_entries header + lines, and the existing post_stock_entry_line()
-- trigger (migration 19) posts the signed stock_ledger_entries rows.
-- ─────────────────────────────────────────────────────────────

-- Per-company sequential numbering (a global sequence would interleave tenants).
create table if not exists public.invoice_counters (
  company_id  uuid not null references public.companies (id) on delete cascade,
  doc_type    text not null check (doc_type in ('sales','purchase')),
  next_no     bigint not null default 1,
  primary key (company_id, doc_type)
);

-- Sales invoices (factures de vente) -----------------------------
create table if not exists public.sales_invoices (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  invoice_no    text,
  customer_id   uuid not null references public.customers (id) on delete restrict,
  warehouse_id  uuid references public.warehouses (id) on delete set null,   -- stock issued FROM here
  invoice_date  date not null default current_date,
  due_date      date,
  status        text not null default 'draft',                               -- draft | validated | cancelled
  tax_rate      numeric(5,2)  not null default 19,                           -- TVA %
  total_ht      numeric(14,2) not null default 0,
  total_tax     numeric(14,2) not null default 0,
  total_ttc     numeric(14,2) not null default 0,
  currency      text not null default 'DZD',
  project_id    uuid references public.projects (id) on delete set null,
  stock_entry_id uuid references public.stock_entries (id) on delete set null,  -- idempotency anchor
  notes         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, invoice_no)
);

create table if not exists public.sales_invoice_lines (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  sales_invoice_id  uuid not null references public.sales_invoices (id) on delete cascade,
  item_id           uuid not null references public.items (id) on delete restrict,
  qty               numeric(14,3) not null check (qty > 0),
  rate              numeric(14,2) not null default 0,
  amount            numeric(14,2) generated always as (round(qty * rate, 2)) stored,
  sort_order        int not null default 0
);

-- Purchase invoices (factures d'achat) ---------------------------
create table if not exists public.purchase_invoices (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  invoice_no    text,
  supplier_id   uuid not null references public.suppliers (id) on delete restrict,
  warehouse_id  uuid references public.warehouses (id) on delete set null,   -- stock received INTO here
  invoice_date  date not null default current_date,
  due_date      date,
  status        text not null default 'draft',
  tax_rate      numeric(5,2)  not null default 19,
  total_ht      numeric(14,2) not null default 0,
  total_tax     numeric(14,2) not null default 0,
  total_ttc     numeric(14,2) not null default 0,
  currency      text not null default 'DZD',
  project_id    uuid references public.projects (id) on delete set null,
  stock_entry_id uuid references public.stock_entries (id) on delete set null,
  notes         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, invoice_no)
);

create table if not exists public.purchase_invoice_lines (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  purchase_invoice_id uuid not null references public.purchase_invoices (id) on delete cascade,
  item_id             uuid not null references public.items (id) on delete restrict,
  qty                 numeric(14,3) not null check (qty > 0),
  rate                numeric(14,2) not null default 0,
  amount              numeric(14,2) generated always as (round(qty * rate, 2)) stored,
  sort_order          int not null default 0
);

create index if not exists sales_invoices_company_status_idx     on public.sales_invoices (company_id, status);
create index if not exists sales_invoices_customer_idx           on public.sales_invoices (customer_id);
create index if not exists sales_invoice_lines_invoice_idx       on public.sales_invoice_lines (sales_invoice_id);
create index if not exists purchase_invoices_company_status_idx  on public.purchase_invoices (company_id, status);
create index if not exists purchase_invoices_supplier_idx        on public.purchase_invoices (supplier_id);
create index if not exists purchase_invoice_lines_invoice_idx    on public.purchase_invoice_lines (purchase_invoice_id);

-- ── Numbering: assign FV-0001 / FA-0001 before insert ──────────
create or replace function public.assign_invoice_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no     bigint;
  v_doc    text := tg_argv[0];   -- 'sales' | 'purchase'
  v_prefix text := tg_argv[1];   -- 'FV'    | 'FA'
begin
  if new.invoice_no is not null then
    return new;
  end if;
  insert into public.invoice_counters (company_id, doc_type, next_no)
    values (new.company_id, v_doc, 2)
  on conflict (company_id, doc_type)
    do update set next_no = public.invoice_counters.next_no + 1
  returning next_no - 1 into v_no;
  new.invoice_no := v_prefix || '-' || lpad(v_no::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists sales_invoices_assign_no on public.sales_invoices;
create trigger sales_invoices_assign_no before insert on public.sales_invoices
  for each row execute function public.assign_invoice_no('sales', 'FV');

drop trigger if exists purchase_invoices_assign_no on public.purchase_invoices;
create trigger purchase_invoices_assign_no before insert on public.purchase_invoices
  for each row execute function public.assign_invoice_no('purchase', 'FA');

-- ── Totals: recompute header from its lines ────────────────────
-- tg_argv: [0]=header table, [1]=lines table, [2]=fk column on lines.
create or replace function public.recompute_invoice_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ht numeric(14,2);
begin
  if tg_op = 'DELETE' then
    v_id := (to_jsonb(old) ->> tg_argv[2])::uuid;
  else
    v_id := (to_jsonb(new) ->> tg_argv[2])::uuid;
  end if;

  execute format('select coalesce(sum(amount), 0) from public.%I where %I = $1', tg_argv[1], tg_argv[2])
    into v_ht using v_id;

  execute format(
    'update public.%I
        set total_ht  = $1,
            total_tax = round($1 * tax_rate / 100, 2),
            total_ttc = $1 + round($1 * tax_rate / 100, 2)
      where id = $2', tg_argv[0])
    using v_ht, v_id;

  return null;
end;
$$;

drop trigger if exists sales_invoice_lines_totals on public.sales_invoice_lines;
create trigger sales_invoice_lines_totals
  after insert or update or delete on public.sales_invoice_lines
  for each row execute function public.recompute_invoice_totals('sales_invoices', 'sales_invoice_lines', 'sales_invoice_id');

drop trigger if exists purchase_invoice_lines_totals on public.purchase_invoice_lines;
create trigger purchase_invoice_lines_totals
  after insert or update or delete on public.purchase_invoice_lines
  for each row execute function public.recompute_invoice_totals('purchase_invoices', 'purchase_invoice_lines', 'purchase_invoice_id');

-- ── Tax: re-derive tax/ttc when the header tax_rate changes ────
create or replace function public.apply_invoice_tax()
returns trigger
language plpgsql
as $$
begin
  new.total_tax := round(new.total_ht * new.tax_rate / 100, 2);
  new.total_ttc := new.total_ht + new.total_tax;
  return new;
end;
$$;

drop trigger if exists sales_invoices_apply_tax on public.sales_invoices;
create trigger sales_invoices_apply_tax before update on public.sales_invoices
  for each row when (new.tax_rate is distinct from old.tax_rate) execute function public.apply_invoice_tax();

drop trigger if exists purchase_invoices_apply_tax on public.purchase_invoices;
create trigger purchase_invoices_apply_tax before update on public.purchase_invoices
  for each row when (new.tax_rate is distinct from old.tax_rate) execute function public.apply_invoice_tax();

-- ── Validation → stock posting (idempotent) ────────────────────
-- tg_argv: [0]='sales'|'purchase', [1]=lines table, [2]=fk column.
create or replace function public.post_invoice_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc   text := tg_argv[0];
  v_lines text := tg_argv[1];
  v_fk    text := tg_argv[2];
  v_etype text;
  v_entry uuid;
begin
  if new.stock_entry_id is not null then
    return new;                                   -- already posted → no double issue
  end if;
  if new.warehouse_id is null then
    raise exception 'warehouse_required'
      using hint = 'Select a warehouse before validating the invoice.';
  end if;

  v_etype := case when v_doc = 'sales' then 'issue' else 'receipt' end;

  insert into public.stock_entries (company_id, entry_type, posting_date, project_id, reference, created_by)
    values (new.company_id, v_etype, new.invoice_date, new.project_id, new.invoice_no, new.created_by)
    returning id into v_entry;

  execute format(
    'insert into public.stock_entry_lines
        (company_id, stock_entry_id, item_id, qty, rate, source_warehouse_id, target_warehouse_id)
      select $1, $2, item_id, qty, rate, %s, %s
        from public.%I where %I = $3',
    case when v_doc = 'sales' then '$4' else 'null' end,   -- source warehouse (sales = issue)
    case when v_doc = 'sales' then 'null' else '$4' end,   -- target warehouse (purchase = receipt)
    v_lines, v_fk)
    using new.company_id, v_entry, new.id, new.warehouse_id;

  new.stock_entry_id := v_entry;
  return new;
end;
$$;

drop trigger if exists sales_invoices_post_stock on public.sales_invoices;
create trigger sales_invoices_post_stock before update on public.sales_invoices
  for each row
  when (new.status = 'validated' and old.status is distinct from 'validated')
  execute function public.post_invoice_stock('sales', 'sales_invoice_lines', 'sales_invoice_id');

drop trigger if exists purchase_invoices_post_stock on public.purchase_invoices;
create trigger purchase_invoices_post_stock before update on public.purchase_invoices
  for each row
  when (new.status = 'validated' and old.status is distinct from 'validated')
  execute function public.post_invoice_stock('purchase', 'purchase_invoice_lines', 'purchase_invoice_id');

-- ── Lock validated invoices (reversal is deferred) ─────────────
create or replace function public.guard_validated_invoice()
returns trigger
language plpgsql
as $$
begin
  raise exception 'invoice_locked'
    using hint = 'A validated invoice cannot be changed. Stock reversal is not supported yet.';
end;
$$;

drop trigger if exists sales_invoices_guard on public.sales_invoices;
create trigger sales_invoices_guard before update on public.sales_invoices
  for each row
  when (old.status = 'validated' and new.status is distinct from 'validated')
  execute function public.guard_validated_invoice();

drop trigger if exists purchase_invoices_guard on public.purchase_invoices;
create trigger purchase_invoices_guard before update on public.purchase_invoices
  for each row
  when (old.status = 'validated' and new.status is distinct from 'validated')
  execute function public.guard_validated_invoice();

-- ── updated_at + RLS ───────────────────────────────────────────
drop trigger if exists sales_invoices_set_updated_at on public.sales_invoices;
create trigger sales_invoices_set_updated_at before update on public.sales_invoices
  for each row execute function public.set_updated_at();

drop trigger if exists purchase_invoices_set_updated_at on public.purchase_invoices;
create trigger purchase_invoices_set_updated_at before update on public.purchase_invoices
  for each row execute function public.set_updated_at();

do $$
declare t text;
begin
  foreach t in array array[
    'invoice_counters','sales_invoices','sales_invoice_lines','purchase_invoices','purchase_invoice_lines'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_company_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (company_id = public.current_company_id())
         with check (company_id = public.current_company_id())',
      t || '_company_rw', t);
  end loop;
end $$;
