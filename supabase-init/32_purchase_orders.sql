-- ─────────────────────────────────────────────────────────────
-- 32 · Bons de commande (purchase orders) + conversion to bon d'achat
--
-- A bon de commande (purchase order) is an order placed with a supplier. It
-- carries NO stock impact — it only becomes stock once converted into a bon
-- d'achat (a draft purchase invoice, migration 26) and that invoice is
-- validated. The header/lines mirror purchase_invoices so the generic totals
-- and tax triggers from migration 26 can be reused verbatim.
-- ─────────────────────────────────────────────────────────────

-- Reuse the per-company numbering counter (migration 26) for a third doc type.
alter table public.invoice_counters drop constraint if exists invoice_counters_doc_type_check;
alter table public.invoice_counters
  add constraint invoice_counters_doc_type_check
  check (doc_type in ('sales','purchase','purchase_order'));

-- Bon de commande (header) --------------------------------------
create table if not exists public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  order_no      text,
  supplier_id   uuid not null references public.suppliers (id) on delete restrict,
  warehouse_id  uuid references public.warehouses (id) on delete set null,   -- optional, copied to the invoice on convert
  order_date    date not null default current_date,
  status        text not null default 'draft',                               -- draft | confirmed | converted | cancelled
  tax_rate      numeric(5,2)  not null default 19,                           -- TVA %
  total_ht      numeric(14,2) not null default 0,
  total_tax     numeric(14,2) not null default 0,
  total_ttc     numeric(14,2) not null default 0,
  currency      text not null default 'DZD',
  project_id    uuid references public.projects (id) on delete set null,
  purchase_invoice_id uuid references public.purchase_invoices (id) on delete set null,  -- generated bon d'achat
  notes         text,
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_id, order_no)
);

create table if not exists public.purchase_order_lines (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  item_id           uuid not null references public.items (id) on delete restrict,
  qty               numeric(14,3) not null check (qty > 0),
  rate              numeric(14,2) not null default 0,
  amount            numeric(14,2) generated always as (round(qty * rate, 2)) stored,
  sort_order        int not null default 0
);

create index if not exists purchase_orders_company_status_idx on public.purchase_orders (company_id, status);
create index if not exists purchase_orders_supplier_idx       on public.purchase_orders (supplier_id);
create index if not exists purchase_order_lines_order_idx     on public.purchase_order_lines (purchase_order_id);

-- ── Numbering: assign BC-0001 before insert ────────────────────
-- Mirrors assign_invoice_no (migration 26) but writes order_no, not invoice_no.
create or replace function public.assign_purchase_order_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no bigint;
begin
  if new.order_no is not null then
    return new;
  end if;
  insert into public.invoice_counters (company_id, doc_type, next_no)
    values (new.company_id, 'purchase_order', 2)
  on conflict (company_id, doc_type)
    do update set next_no = public.invoice_counters.next_no + 1
  returning next_no - 1 into v_no;
  new.order_no := 'BC-' || lpad(v_no::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists purchase_orders_assign_no on public.purchase_orders;
create trigger purchase_orders_assign_no before insert on public.purchase_orders
  for each row execute function public.assign_purchase_order_no();

-- ── Totals + tax: reuse the generic functions from migration 26 ─
drop trigger if exists purchase_order_lines_totals on public.purchase_order_lines;
create trigger purchase_order_lines_totals
  after insert or update or delete on public.purchase_order_lines
  for each row execute function public.recompute_invoice_totals('purchase_orders', 'purchase_order_lines', 'purchase_order_id');

drop trigger if exists purchase_orders_apply_tax on public.purchase_orders;
create trigger purchase_orders_apply_tax before update on public.purchase_orders
  for each row when (new.tax_rate is distinct from old.tax_rate) execute function public.apply_invoice_tax();

drop trigger if exists purchase_orders_set_updated_at on public.purchase_orders;
create trigger purchase_orders_set_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();

-- NOTE: deliberately NO stock-posting trigger — a bon de commande never moves
-- stock. Edits are gated by status in the UI.

-- ── Convert a bon de commande → draft bon d'achat (idempotent) ──
-- Called from the UI as supabase.rpc('convert_purchase_order_to_invoice', { p_order }).
-- Returns the (new or existing) purchase_invoices.id so the client can navigate to it.
create or replace function public.convert_purchase_order_to_invoice(p_order uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice uuid;
  o public.purchase_orders%rowtype;
begin
  select * into o from public.purchase_orders where id = p_order;
  if not found then
    raise exception 'purchase_order_not_found';
  end if;
  if o.company_id <> public.current_company_id() then
    raise exception 'forbidden';
  end if;

  -- Already converted → return the existing link, never duplicate.
  if o.purchase_invoice_id is not null then
    return o.purchase_invoice_id;
  end if;

  insert into public.purchase_invoices
    (company_id, supplier_id, warehouse_id, invoice_date, status, tax_rate, project_id, notes)
  values
    (o.company_id, o.supplier_id, o.warehouse_id, current_date, 'draft', o.tax_rate, o.project_id,
     'BC ' || coalesce(o.order_no, ''))
  returning id into v_invoice;

  insert into public.purchase_invoice_lines
    (company_id, purchase_invoice_id, item_id, qty, rate, sort_order)
  select company_id, v_invoice, item_id, qty, rate, sort_order
    from public.purchase_order_lines
   where purchase_order_id = p_order
   order by sort_order;

  update public.purchase_orders
     set status = 'converted', purchase_invoice_id = v_invoice
   where id = p_order;

  return v_invoice;
end;
$$;

revoke all on function public.convert_purchase_order_to_invoice(uuid) from public;
grant execute on function public.convert_purchase_order_to_invoice(uuid) to authenticated;

-- ── RLS ────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['purchase_orders','purchase_order_lines'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_company_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (company_id = public.current_company_id())
         with check (company_id = public.current_company_id())',
      t || '_company_rw', t);
  end loop;
end $$;
