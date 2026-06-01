-- ─────────────────────────────────────────────────────────────
-- 06 · Multi-enterprise support
--
-- A user can create and belong to several organizations (enterprises)
-- and switch between them. profiles.org_id is the *active* enterprise;
-- membership lives in user_roles. All domain data is isolated per
-- active enterprise via current_org_id() (see 05_rls.sql / 11_domain_rls.sql).
-- ─────────────────────────────────────────────────────────────

-- Track who created an organization (used to grant initial admin).
alter table public.organizations
  add column if not exists created_by uuid default auth.uid();

-- Generic updated_at trigger function (reused by every domain table).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Is the caller a member of the given org?
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and org_id = org
  );
$$;

-- The account switcher must list *every* org the user belongs to,
-- so widen the organizations SELECT policy from active-only to membership.
drop policy if exists "orgs_select_member" on public.organizations;
create policy "orgs_select_member" on public.organizations
  for select using (public.is_org_member(id));

-- Any authenticated user may create an enterprise (they become its admin).
drop policy if exists "orgs_insert_authenticated" on public.organizations;
create policy "orgs_insert_authenticated" on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());

-- On creation, grant the creator the admin role and make it their active org.
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is not null then
    insert into public.user_roles (user_id, org_id, role_key)
    values (new.created_by, new.id, 'admin')
    on conflict do nothing;

    update public.profiles
      set org_id = new.id
      where id = new.created_by and org_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists on_organization_created on public.organizations;
create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- RPC: create an enterprise from the app (returns the new row).
create or replace function public.create_organization(p_name text, p_slug text default null)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_org public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_slug := coalesce(
    nullif(trim(p_slug), ''),
    regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')
  );

  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), v_slug, auth.uid())
  returning * into v_org;

  return v_org;
end;
$$;

-- RPC: switch the active enterprise (only to one the user belongs to).
create or replace function public.set_active_organization(org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_org_member(org) then
    raise exception 'Not a member of this organization';
  end if;
  update public.profiles set org_id = org where id = auth.uid();
end;
$$;
