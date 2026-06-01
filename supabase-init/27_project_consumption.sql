-- ─────────────────────────────────────────────────────────────
-- 27 · Project material consumption (derived)
--
-- A project consumes stock by creating an 'issue' stock_entry linked to the
-- project (see the "Consume" action on the project page). How much of each
-- item has already been issued to a project is fully derivable from the
-- ledger, so this is a view — no extra table, no extra RLS (security_invoker
-- inherits the stock_entries / stock_entry_lines policies).
--
--   remaining = project_items.qty − coalesce(consumed_qty, 0)
--
-- Issuing only the remaining quantity is what prevents double-issuing.
-- ─────────────────────────────────────────────────────────────
create or replace view public.project_item_consumption
with (security_invoker = true) as
  select se.company_id,
         se.project_id,
         sel.item_id,
         sum(sel.qty) as consumed_qty
  from public.stock_entries se
  join public.stock_entry_lines sel on sel.stock_entry_id = se.id
  where se.entry_type = 'issue'
    and se.project_id is not null
  group by se.company_id, se.project_id, sel.item_id;
