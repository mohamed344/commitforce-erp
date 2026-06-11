-- ═══════════════════════════════════════════════════════════════
-- apply_32_36.sql — this session's migrations, in order.
--
-- Run this in the SQL editor of project xrjkckpchaanapyhyrbt (the one in
-- your app's .env.local), NOT a blank project. It assumes 01-31 already
-- exist there. Every statement is idempotent, so re-running is safe.
-- Covers: bons de commande + chiffrage workflow (32-35) and the CRM lead
-- activity timeline (36).
-- ═══════════════════════════════════════════════════════════════


-- ╔═══════════════════════════════════════════════════════════════
-- ║ 32_purchase_orders.sql
-- ╚═══════════════════════════════════════════════════════════════
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


-- ╔═══════════════════════════════════════════════════════════════
-- ║ 33_purchase_price_layers.sql
-- ╚═══════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────
-- 33 · Purchase price layers — history, FIFO valuation, project cost
--
-- Every validated bon d'achat (purchase invoice, migration 26) posts a signed
-- +qty_change row into stock_ledger_entries (migration 19) carrying the price
-- paid and the posting date. That ledger IS the raw price history: each inbound
-- row is a "cost layer". These three views derive, with no extra tables:
--
--   · item_purchase_prices  → every purchase price ever paid for a product
--   · item_cost_layers      → FIFO allocation (received / consumed / remaining)
--   · project_material_cost → per-project actual cost from its own purchases
--
-- All are security_invoker views so they inherit the RLS of the underlying
-- tables (same pattern as stock_balances and project_item_consumption).
-- ─────────────────────────────────────────────────────────────

-- Every inbound price layer for a product, newest context attached -----------
create or replace view public.item_purchase_prices
with (security_invoker = true) as
  select sle.company_id,
         sle.item_id,
         sle.id            as ledger_id,
         sle.warehouse_id,
         sle.posting_date,
         sle.rate,
         sle.qty_change    as qty,
         pi.id             as purchase_invoice_id,
         pi.invoice_no,
         pi.supplier_id,
         s.name            as supplier_name,
         pi.project_id
  from public.stock_ledger_entries sle
  left join public.purchase_invoices pi on pi.stock_entry_id = sle.stock_entry_id
  left join public.suppliers s on s.id = pi.supplier_id
  where sle.qty_change > 0          -- inbound (receipt) rows only
  order by sle.item_id, sle.posting_date, sle.created_at;

-- FIFO cost layers: how much of each receipt layer is still on hand -----------
-- Issues are allocated oldest-first. For each receipt we know how much was
-- received in strictly-earlier layers (recv_before); a layer is consumed up to
-- where the running total of all issues for the item overlaps its band.
-- Granularity is per (company_id, item_id) — NOT per warehouse — because
-- purchases and project issues frequently use different warehouses, and the
-- business question ("what did this product cost me") is item-level. The
-- warehouse_id column is retained for display only.
create or replace view public.item_cost_layers
with (security_invoker = true) as
with receipts as (
  select company_id, item_id, id as ledger_id, warehouse_id, posting_date, created_at,
         rate, qty_change as qty,
         sum(qty_change) over (
           partition by company_id, item_id
           order by posting_date, created_at
           rows between unbounded preceding and 1 preceding
         ) as recv_before
  from public.stock_ledger_entries
  where qty_change > 0
),
issued as (
  select company_id, item_id, sum(-qty_change) as total_issued
  from public.stock_ledger_entries
  where qty_change < 0
  group by company_id, item_id
)
select r.company_id,
       r.item_id,
       r.ledger_id,
       r.warehouse_id,
       r.posting_date,
       r.rate,
       r.qty as received_qty,
       greatest(0, least(r.qty, coalesce(i.total_issued, 0) - coalesce(r.recv_before, 0))) as consumed_qty,
       r.qty - greatest(0, least(r.qty, coalesce(i.total_issued, 0) - coalesce(r.recv_before, 0))) as remaining_qty
from receipts r
left join issued i on i.company_id = r.company_id and i.item_id = r.item_id
order by r.item_id, r.posting_date, r.created_at;

-- Per-project material cost from that project's own purchases -----------------
create or replace view public.project_material_cost
with (security_invoker = true) as
  select ipp.company_id,
         ipp.project_id,
         ipp.item_id,
         sum(ipp.qty)            as purchased_qty,
         sum(ipp.qty * ipp.rate) as total_cost,
         case when sum(ipp.qty) > 0
              then round(sum(ipp.qty * ipp.rate) / sum(ipp.qty), 2)
              else null end      as avg_rate
  from public.item_purchase_prices ipp
  where ipp.project_id is not null
  group by ipp.company_id, ipp.project_id, ipp.item_id;


-- ╔═══════════════════════════════════════════════════════════════
-- ║ 34_role_permissions.sql
-- ╚═══════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────
-- 34 · Per-role permission selections (save-only)
--
-- Adds a `permissions` array to the company-scoped roles from migration 28.
-- Each entry is a "<moduleKey>:<action>" string (e.g. 'stock:view',
-- 'sales:create'), where moduleKey is one of the 8 ERP modules and action is
-- one of view / create / edit / delete. This stores the admin's selections so
-- they round-trip in the role form; it does NOT yet gate module visibility or
-- data access (that stays driven by the admin/member tier + RLS).
--
-- No RLS changes are needed — the existing company_roles_manage_admin /
-- company_roles_select_member policies (migration 28) already cover the column.
-- ─────────────────────────────────────────────────────────────
alter table public.company_roles
  add column if not exists permissions text[] not null default '{}';


-- ╔═══════════════════════════════════════════════════════════════
-- ║ 35_chiffrage_workflow.sql
-- ╚═══════════════════════════════════════════════════════════════
-- ─────────────────────────────────────────────────────────────
-- 35 · Bon de commande as a chiffrage → stock-review → bon d'achat flow
--
-- Reworks the bon de commande (migration 32) from a supplier-first purchase
-- order into a two-person requisition flow:
--
--   1. Chiffrage (user A) — lists products + quantities + a chiffrage date.
--      NO supplier; rate stays 0 (the document is a requisition, not priced).
--   2. Stock review (user B) — records how much of each line is already in
--      stock (in_stock_qty); missing_qty is derived.
--   3. Bon d'achat — only the missing quantities are pushed into a draft
--      purchase invoice, and the supplier is chosen at THIS point.
--
-- Status now flows: draft → pending_review → reviewed → converted (+ cancelled).
-- `status` is plain text (no CHECK in migration 32) so no constraint change is
-- needed. Permission gating (sales:create / sales:edit) is enforced in the UI.
-- ─────────────────────────────────────────────────────────────

-- Supplier is no longer known at chiffrage time — only when the bon d'achat is
-- generated. Make it optional; convert() fills it in.
alter table public.purchase_orders
  alter column supplier_id drop not null;

-- Reviewer-entered on-hand qty, and the derived shortfall to purchase.
alter table public.purchase_order_lines
  add column if not exists in_stock_qty numeric(14,3) not null default 0;

alter table public.purchase_order_lines
  add column if not exists missing_qty numeric(14,3)
    generated always as (greatest(qty - in_stock_qty, 0)) stored;

-- ── Convert a reviewed bon de commande → draft bon d'achat (idempotent) ──
-- Now takes the supplier (and optional warehouse) chosen by the reviewer, and
-- copies ONLY the lines that are short on stock, at their missing quantity.
-- Old single-arg signature is dropped first (return path differs).
drop function if exists public.convert_purchase_order_to_invoice(uuid);

create or replace function public.convert_purchase_order_to_invoice(
  p_order     uuid,
  p_supplier  uuid,
  p_warehouse uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice uuid;
  o public.purchase_orders%rowtype;
  v_missing int;
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

  -- Nothing short on stock → no bon d'achat to create.
  select count(*) into v_missing
    from public.purchase_order_lines
   where purchase_order_id = p_order and missing_qty > 0;
  if v_missing = 0 then
    raise exception 'nothing_to_purchase';
  end if;

  insert into public.purchase_invoices
    (company_id, supplier_id, warehouse_id, invoice_date, status, tax_rate, project_id, notes)
  values
    (o.company_id, p_supplier, p_warehouse, current_date, 'draft', o.tax_rate, o.project_id,
     'BC ' || coalesce(o.order_no, ''))
  returning id into v_invoice;

  -- Only the shortfall, at the missing quantity (priced later on the invoice).
  insert into public.purchase_invoice_lines
    (company_id, purchase_invoice_id, item_id, qty, rate, sort_order)
  select company_id, v_invoice, item_id, missing_qty, rate, sort_order
    from public.purchase_order_lines
   where purchase_order_id = p_order and missing_qty > 0
   order by sort_order;

  update public.purchase_orders
     set status = 'converted',
         purchase_invoice_id = v_invoice,
         supplier_id = p_supplier,
         warehouse_id = p_warehouse
   where id = p_order;

  return v_invoice;
end;
$$;

revoke all on function public.convert_purchase_order_to_invoice(uuid, uuid, uuid) from public;
grant execute on function public.convert_purchase_order_to_invoice(uuid, uuid, uuid) to authenticated;

-- NOTE: no RLS changes — the existing purchase_orders / purchase_order_lines
-- company policies (migration 32) already cover the new columns.


-- ╔═══════════════════════════════════════════════════════════════
-- ║ 36_lead_activities.sql
-- ╚═══════════════════════════════════════════════════════════════
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

