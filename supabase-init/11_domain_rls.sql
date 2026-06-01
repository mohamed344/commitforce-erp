-- ─────────────────────────────────────────────────────────────
-- 11 · RLS for domain tables
--
-- Every domain row carries org_id and is visible/editable only within
-- the caller's *active* enterprise (current_org_id()). This is what
-- keeps each enterprise's data fully separated.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  t text;
  domain_tables text[] := array[
    'projects', 'categories', 'item_attributes', 'item_attribute_values',
    'items', 'template_attributes', 'item_variant_attributes'
  ];
begin
  foreach t in array domain_tables loop
    execute format('drop policy if exists %I on public.%I', t || '_org_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (org_id = public.current_org_id())
         with check (org_id = public.current_org_id())',
      t || '_org_rw', t
    );
  end loop;
end;
$$;
