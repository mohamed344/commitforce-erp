-- ─────────────────────────────────────────────────────────────
-- 34 · Per-role permission selections (save-only)
--
-- Adds a `permissions` array to the company-scoped roles from migration 28.
-- Each entry is a "<moduleKey>:<action>" string (e.g. 'stock:view',
-- 'sales:create'), where moduleKey is one of the 8 ERP modules and action is
-- one of view / create / edit / delete. This stores the admin's selections so
-- they round-trip in the role form; it does NOT yet gate module visibility or
-- data access (that stays driven by the admin/member tier + RLS).
--
-- No RLS changes are needed — the existing company_roles_manage_admin /
-- company_roles_select_member policies (migration 28) already cover the column.
-- ─────────────────────────────────────────────────────────────
alter table public.company_roles
  add column if not exists permissions text[] not null default '{}';
