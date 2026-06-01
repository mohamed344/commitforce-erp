-- ─────────────────────────────────────────────────────────────
-- 03 · Roles & user_roles (basic RBAC)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.roles (
  key         text primary key,            -- 'admin', 'member', ...
  label       text not null,
  description text
);

create table if not exists public.user_roles (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  role_key    text not null references public.roles (key) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, org_id, role_key)
);

alter table public.roles enable row level security;
alter table public.user_roles enable row level security;

insert into public.roles (key, label, description) values
  ('admin',  'Administrator', 'Full access to the organization.'),
  ('member', 'Member',        'Standard access.')
on conflict (key) do nothing;
