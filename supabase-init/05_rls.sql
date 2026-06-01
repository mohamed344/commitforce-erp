-- ─────────────────────────────────────────────────────────────
-- 05 · Row Level Security policies
--
-- Model: a user belongs to one organization via profiles.org_id.
-- Members see their own org's data; admins manage it. The modules
-- catalog is readable by any authenticated user.
-- ─────────────────────────────────────────────────────────────

-- Helper: the caller's organization (from their profile).
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- Helper: is the caller an admin of the given org?
create or replace function public.is_org_admin(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and org_id = org and role = 'admin'
  );
$$;

-- ── profiles ─────────────────────────────────────────────────
drop policy if exists "profiles_select_self_or_org" on public.profiles;
create policy "profiles_select_self_or_org" on public.profiles
  for select using (
    id = auth.uid() or org_id = public.current_org_id()
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ── organizations ────────────────────────────────────────────
drop policy if exists "orgs_select_member" on public.organizations;
create policy "orgs_select_member" on public.organizations
  for select using (id = public.current_org_id());

drop policy if exists "orgs_update_admin" on public.organizations;
create policy "orgs_update_admin" on public.organizations
  for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

-- ── roles (read-only catalog) ─────────────────────────────────
drop policy if exists "roles_select_all" on public.roles;
create policy "roles_select_all" on public.roles
  for select to authenticated using (true);

-- ── user_roles ───────────────────────────────────────────────
drop policy if exists "user_roles_select_org" on public.user_roles;
create policy "user_roles_select_org" on public.user_roles
  for select using (org_id = public.current_org_id());

drop policy if exists "user_roles_manage_admin" on public.user_roles;
create policy "user_roles_manage_admin" on public.user_roles
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- ── modules (read-only catalog) ───────────────────────────────
drop policy if exists "modules_select_all" on public.modules;
create policy "modules_select_all" on public.modules
  for select to authenticated using (true);

-- ── org_modules ──────────────────────────────────────────────
drop policy if exists "org_modules_select_member" on public.org_modules;
create policy "org_modules_select_member" on public.org_modules
  for select using (org_id = public.current_org_id());

drop policy if exists "org_modules_manage_admin" on public.org_modules;
create policy "org_modules_manage_admin" on public.org_modules
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
