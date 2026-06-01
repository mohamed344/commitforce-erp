-- ─────────────────────────────────────────────────────────────
-- 16 · Default company_id to the caller's active company
--
-- Lets the app insert domain rows without passing company_id; the value
-- defaults to current_company_id() and satisfies the RLS WITH CHECK.
-- ─────────────────────────────────────────────────────────────
alter table public.projects                alter column company_id set default public.current_company_id();
alter table public.categories              alter column company_id set default public.current_company_id();
alter table public.item_attributes         alter column company_id set default public.current_company_id();
alter table public.item_attribute_values   alter column company_id set default public.current_company_id();
alter table public.items                   alter column company_id set default public.current_company_id();
alter table public.template_attributes     alter column company_id set default public.current_company_id();
alter table public.item_variant_attributes alter column company_id set default public.current_company_id();
alter table public.leads                   alter column company_id set default public.current_company_id();
