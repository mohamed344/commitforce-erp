-- ─────────────────────────────────────────────────────────────
-- 25 · Sales/Purchases parties — customers (clients) & suppliers (fournisseurs)
--
-- Two near-identical company-scoped masters. They are the counterparties on
-- sales invoices (factures de vente) and purchase invoices (factures d'achat)
-- added in migration 26.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  name        text not null,
  code        text,
  email       text,
  phone       text,
  address     text,
  tax_id      text,                                   -- NIF / RC / ART (Algerian fiscal ids)
  notes       text,
  is_active   boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null default public.current_company_id() references public.companies (id) on delete cascade,
  name        text not null,
  code        text,
  email       text,
  phone       text,
  address     text,
  tax_id      text,
  notes       text,
  is_active   boolean not null default true,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_id, name)
);

create index if not exists customers_company_idx on public.customers (company_id);
create index if not exists suppliers_company_idx on public.suppliers (company_id);

-- updated_at + RLS (mirrors the pattern in 18/19).
do $$
declare t text;
begin
  foreach t in array array['customers','suppliers'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_company_rw', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (company_id = public.current_company_id())
         with check (company_id = public.current_company_id())',
      t || '_company_rw', t);
  end loop;
end $$;
