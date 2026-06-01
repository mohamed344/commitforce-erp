-- ─────────────────────────────────────────────────────────────
-- 14 · Storage bucket for company logos
--
-- Public bucket (so the logo's public URL renders without auth) that
-- accepts small images. Authenticated users may upload; everyone may read.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  true,
  2097152,  -- 2 MB
  array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects already has RLS enabled by Supabase; add scoped policies.
drop policy if exists "company_logos_read" on storage.objects;
create policy "company_logos_read" on storage.objects
  for select using (bucket_id = 'company-logos');

drop policy if exists "company_logos_insert" on storage.objects;
create policy "company_logos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'company-logos');

drop policy if exists "company_logos_update" on storage.objects;
create policy "company_logos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'company-logos' and owner = auth.uid())
  with check (bucket_id = 'company-logos');

drop policy if exists "company_logos_delete" on storage.objects;
create policy "company_logos_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'company-logos' and owner = auth.uid());
