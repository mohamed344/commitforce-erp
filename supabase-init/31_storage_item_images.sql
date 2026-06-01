-- ─────────────────────────────────────────────────────────────
-- 31 · Storage bucket for item (product) images
--
-- Public bucket (so an item image's public URL renders without auth) that
-- accepts small images. Authenticated users may upload; everyone may read.
-- Mirrors migration 14 (company-logos).
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-images',
  'item-images',
  true,
  2097152,  -- 2 MB
  array['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml','image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "item_images_read" on storage.objects;
create policy "item_images_read" on storage.objects
  for select using (bucket_id = 'item-images');

drop policy if exists "item_images_insert" on storage.objects;
create policy "item_images_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-images');

drop policy if exists "item_images_update" on storage.objects;
create policy "item_images_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-images' and owner = auth.uid())
  with check (bucket_id = 'item-images');

drop policy if exists "item_images_delete" on storage.objects;
create policy "item_images_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-images' and owner = auth.uid());
