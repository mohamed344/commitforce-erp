-- ─────────────────────────────────────────────────────────────
-- 13 · Add phone to profiles + capture full_name/phone on signup
--
-- The register form passes full_name and phone as auth user metadata
-- (raw_user_meta_data); the signup trigger copies them into the profile.
-- ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
