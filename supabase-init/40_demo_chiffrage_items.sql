-- ─────────────────────────────────────────────────────────────
-- 40 · Demo items for the CRM chiffrage CSV (electrical/construction BOQ)
--
-- Creates the 20 articles from the sample QTE so the CSV import auto-matches
-- them BY NAME (the sample sheet has no reference column). Prices land in
-- items.standard_buying_rate (+ valuation_rate); FIVE items are left at price 0
-- on purpose so they show up in the Consultation tab (fiche de consultation).
-- On-hand stock is seeded via stock_ledger_entries with varied quantities
-- (some enough, some insufficient, some zero) so material statuses differ.
--
-- Idempotent: matches existing items by (company_id, name) and updates them;
-- re-running replaces each item's seeded ledger. Run in project xrjkckpchaanapyhyrbt.
-- ─────────────────────────────────────────────────────────────

do $$
declare
  v_company uuid;
  v_wh      uuid;
  v_item    uuid;
  r         record;
begin
  -- Same company as existing items (keeps RLS consistent); fallback to first company.
  select company_id into v_company from public.items order by created_at limit 1;
  if v_company is null then
    select id into v_company from public.companies order by created_at limit 1;
  end if;
  if v_company is null then
    raise exception 'No company found — create a company first.';
  end if;

  -- A concrete (non-group) warehouse to hold the seeded stock.
  select id into v_wh from public.warehouses
    where company_id = v_company and coalesce(is_group, false) = false
    order by created_at limit 1;
  if v_wh is null then
    insert into public.warehouses (company_id, name, is_group)
    values (v_company, 'Magasin principal', false)
    returning id into v_wh;
  end if;

  for r in
    select * from (values
      ('Câble électrique HO7V-U 2.5mm² (rouleau 100m)', 'Rouleau', 8500.00,   50),
      ('Disjoncteur différentiel 30mA 40A',             'U',       4200.00,    3),
      ('Tableau électrique 3 rangées 36 modules',       'U',          0.00,   10),  -- consultation
      ('Prise de courant 2P+T 16A encastrée',           'U',        180.00,  200),
      ('Interrupteur simple va-et-vient',               'U',        220.00,    0),
      ('Gaine ICTA Ø20mm (rouleau 100m)',               'Rouleau',  950.00,   15),
      ('Boîte d''encastrement Ø67 simple',              'U',          0.00,  120),  -- consultation
      ('Tube PVC évacuation Ø100mm',                    'ML',       380.00,   25),
      ('Coude PVC 87°30 Ø100',                          'U',        120.00,   60),
      ('Robinet d''arrêt laiton 1/2"',                  'U',        650.00,    0),
      ('Ciment CPJ 42.5 (sac 50kg)',                    'Sac',      780.00,  500),
      ('Sable de carrière 0/4',                         'M3',         0.00,   40),  -- consultation
      ('Gravier 8/15',                                  'M3',      2800.00,   12),
      ('Fer à béton HA Ø12',                            'Kg',       145.00, 5000),
      ('Brique creuse 12 trous',                        'U',         28.00, 2000),
      ('Peinture vinylique blanche (pot 25kg)',         'Pot',        0.00,   30),  -- consultation
      ('Carrelage grès 60x60 (boîte 1.44m²)',           'Boîte',   1650.00,   80),
      ('Porte intérieure isoplane 80cm',                'U',       7800.00,   20),
      ('Fenêtre aluminium coulissante 1.2x1.2m',        'U',          0.00,    0),  -- consultation
      ('Spot LED encastrable 7W',                       'U',        340.00,  150)
    ) as t(name, uom, price, qty)
  loop
    select id into v_item from public.items
      where company_id = v_company and name = r.name limit 1;

    if v_item is null then
      insert into public.items
        (company_id, item_type, name, uom, is_active, standard_buying_rate, valuation_rate, standard_selling_rate)
      values
        (v_company, 'template', r.name, r.uom, true, r.price, r.price, round(r.price * 1.2, 2))
      returning id into v_item;
    else
      update public.items
        set standard_buying_rate = r.price,
            valuation_rate = r.price,
            standard_selling_rate = round(r.price * 1.2, 2),
            uom = r.uom,
            is_active = true
      where id = v_item;
    end if;

    -- Reset seeded stock for this item, then post the on-hand qty (if any).
    delete from public.stock_ledger_entries where item_id = v_item;
    if r.qty > 0 then
      insert into public.stock_ledger_entries
        (company_id, item_id, warehouse_id, qty_change, rate, posting_date)
      values
        (v_company, v_item, v_wh, r.qty, r.price, current_date);
    end if;
  end loop;
end $$;

-- Make the new rows visible to the API immediately.
notify pgrst, 'reload schema';
