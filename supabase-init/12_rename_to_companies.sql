-- ─────────────────────────────────────────────────────────────
-- 12 · Rename the "organization" entity to "company"
--
-- Runs as part of the ordered install: files 01–11 create the entity as
-- `organizations` / `org_id`; this file finalizes the naming to
-- `companies` / `company_id` (matching ERPNext's "Company") and renames
-- the helper functions and RPCs accordingly.
--
-- Renaming a table/column/function keeps its OID, so RLS policies, CHECK
-- constraints, defaults, FKs and triggers (which reference by OID/attnum,
-- not by name) follow automatically — only function *bodies* (stored as
-- text) are rewritten below.
-- ─────────────────────────────────────────────────────────────
begin;

-- 1) Table + every org_id column ------------------------------------------------
alter table public.organizations rename to companies;

alter table public.org_modules rename to company_modules;

alter table public.profiles                rename column org_id to company_id;
alter table public.user_roles              rename column org_id to company_id;
alter table public.company_modules         rename column org_id to company_id;
alter table public.projects                rename column org_id to company_id;
alter table public.categories              rename column org_id to company_id;
alter table public.item_attributes         rename column org_id to company_id;
alter table public.item_attribute_values   rename column org_id to company_id;
alter table public.items                   rename column org_id to company_id;
alter table public.template_attributes     rename column org_id to company_id;
alter table public.item_variant_attributes rename column org_id to company_id;

-- 2) Helper functions — rewrite body for the new column, then rename ------------
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid();
$$;
alter function public.current_org_id() rename to current_company_id;

-- NOTE: keep the existing parameter name `org` (CREATE OR REPLACE cannot
-- rename a parameter); only the body and the function name change.
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid() and company_id = org
  );
$$;
alter function public.is_org_member(uuid) rename to is_company_member;

create or replace function public.is_org_admin(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and company_id = org and role = 'admin'
  );
$$;
alter function public.is_org_admin(uuid) rename to is_company_admin;

-- 3) Creator trigger ------------------------------------------------------------
create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.user_roles (user_id, company_id, role_key)
    values (new.created_by, new.id, 'admin')
    on conflict do nothing;

    update public.profiles
      set company_id = new.id
      where id = new.created_by and company_id is null;
  end if;
  return new;
end;
$$;
alter function public.handle_new_organization() rename to handle_new_company;
alter trigger on_organization_created on public.companies rename to on_company_created;

-- 4) RPCs (renamed; bodies target companies) -----------------------------------
drop function if exists public.create_organization(text, text);
create or replace function public.create_company(
  p_name text,
  p_slug text default null,
  p_email text default null,
  p_logo_url text default null
)
returns public.companies
language plpgsql security definer set search_path = public as $$
declare
  v_slug text;
  v_company public.companies;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_slug := coalesce(
    nullif(trim(p_slug), ''),
    regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')
  );

  insert into public.companies (name, slug, email, logo_url, created_by)
  values (trim(p_name), v_slug, nullif(trim(p_email), ''), nullif(trim(p_logo_url), ''), auth.uid())
  returning * into v_company;

  return v_company;
end;
$$;

drop function if exists public.set_active_organization(uuid);
create or replace function public.set_active_company(c uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_company_member(c) then
    raise exception 'Not a member of this company';
  end if;
  update public.profiles set company_id = c where id = auth.uid();
end;
$$;

commit;
