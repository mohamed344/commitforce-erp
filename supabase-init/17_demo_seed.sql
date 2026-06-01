-- ─────────────────────────────────────────────────────────────
-- 17 · Demo seed data (Projects, Stock items, CRM leads)
--
-- Targets the active company of account mohamedbfrbrm@gmail.com so the
-- data is visible when that user is logged in. Idempotent: each block only
-- inserts when the company has no rows of that kind yet.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  cid uuid;
begin
  select p.company_id into cid
    from public.profiles p
    join auth.users u on u.id = p.id
    where u.email = 'mohamedbfrbrm@gmail.com';
  if cid is null then
    raise notice 'No active company for the target user; skipping demo seed.';
    return;
  end if;

  -- ── Projects ───────────────────────────────────────────────
  if not exists (select 1 from public.projects where company_id = cid) then
    insert into public.projects (company_id, name, code, status, start_date, end_date) values
      (cid, 'Refonte du site web',     'PRJ-001', 'active',    current_date - 20, null),
      (cid, 'Migration ERP',           'PRJ-002', 'planning',  null, null),
      (cid, 'Audit qualité',           'PRJ-003', 'on_hold',   current_date - 60, null),
      (cid, 'Lancement produit X',     'PRJ-004', 'completed', current_date - 120, current_date - 10),
      (cid, 'Campagne marketing Q3',   'PRJ-005', 'active',    current_date - 5,  null);
  end if;

  -- ── Categories + Items ─────────────────────────────────────
  if not exists (select 1 from public.categories where company_id = cid) then
    insert into public.categories (company_id, name) values
      (cid, 'Matières premières'),
      (cid, 'Produits finis'),
      (cid, 'Consommables');
  end if;

  if not exists (select 1 from public.items where company_id = cid) then
    -- templates / standalone
    insert into public.items (company_id, name, sku, item_type, category_id, uom) values
      (cid, 'Tôle d''acier', 'STL-001', 'template',
        (select id from public.categories where company_id = cid and name = 'Matières premières'), 'Kg'),
      (cid, 'Vis M6',        'VIS-006', 'template',
        (select id from public.categories where company_id = cid and name = 'Consommables'), 'Unit'),
      (cid, 'Bureau ergonomique', 'BUR-100', 'template',
        (select id from public.categories where company_id = cid and name = 'Produits finis'), 'Unit'),
      (cid, 'T-shirt', 'TSH-000', 'template',
        (select id from public.categories where company_id = cid and name = 'Produits finis'), 'Unit');

    -- variants of the T-shirt template
    insert into public.items (company_id, name, sku, item_type, template_id, category_id, uom) values
      (cid, 'T-shirt Rouge M', 'TSH-RM', 'variant',
        (select id from public.items where company_id = cid and name = 'T-shirt' and item_type = 'template'),
        (select id from public.categories where company_id = cid and name = 'Produits finis'), 'Unit'),
      (cid, 'T-shirt Bleu L',  'TSH-BL', 'variant',
        (select id from public.items where company_id = cid and name = 'T-shirt' and item_type = 'template'),
        (select id from public.categories where company_id = cid and name = 'Produits finis'), 'Unit');
  end if;

  -- ── CRM leads (across pipeline stages) ─────────────────────
  if not exists (select 1 from public.leads where company_id = cid) then
    insert into public.leads (company_id, title, contact_name, email, phone, value, stage) values
      (cid, 'Contrat ACME',          'Karim Saïdi',   'karim@acme.dz',     '+213551000001', 50000,  'qualified'),
      (cid, 'Projet Beta',           'Lina Bouzid',   'lina@beta.dz',      '+213551000002', 12000,  'new'),
      (cid, 'Devis Gamma',           'Yacine Brahimi','yacine@gamma.dz',   '+213551000003', 8000,   'contacted'),
      (cid, 'Deal Delta',            'Sofia Mansouri','sofia@delta.dz',    '+213551000004', 120000, 'won'),
      (cid, 'Opportunité Epsilon',   'Omar Haddad',   'omar@epsilon.dz',   '+213551000005', 30000,  'lost'),
      (cid, 'Partenariat Zeta',      'Nadia Cherif',  'nadia@zeta.dz',     '+213551000006', 45000,  'new');
  end if;
end $$;
