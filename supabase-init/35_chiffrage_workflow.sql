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
