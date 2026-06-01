-- ─────────────────────────────────────────────────────────────
-- 99 · Seed data
-- ─────────────────────────────────────────────────────────────

-- Default organization (matches the env defaults).
insert into public.organizations (name, slug, email)
values ('IMAB Engineering', 'imab-engineering', 'admin@imab-engineering.dz')
on conflict (slug) do nothing;

-- Module catalog (order + names mirror config/modules.ts).
insert into public.modules (key, name, icon, sort_order, default_enabled) values
  ('stock',      'Stock',            'stock',      1, false),
  ('sales',      'Sales / Purchases','sales',      2, false),
  ('crm',        'CRM',              'crm',        3, false),
  ('production', 'Production',       'production', 4, false),
  ('projects',   'Projects',         'projects',   5, false),
  ('hr',         'Human Resources',  'hr',         6, false),
  ('reports',    'Reports',          'reports',    7, false),
  ('settings',   'Settings',         'settings',   8, false)
on conflict (key) do nothing;
