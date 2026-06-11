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
