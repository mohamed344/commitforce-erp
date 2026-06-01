-- ─────────────────────────────────────────────────────────────
-- 21 · Realistic IMAB Engineering stock seed (electrical / automation)
--      Targets the active company of mohamedbfrbrm@gmail.com. Idempotent.
-- ─────────────────────────────────────────────────────────────
do $$
declare
  cid uuid;
  wh_main uuid; wh_atelier uuid;
  cat_app uuid; cat_cable uuid; cat_auto uuid; cat_arm uuid;
  b_schneider uuid; b_siemens uuid; b_abb uuid; b_legrand uuid; b_phoenix uuid;
  u_unit uuid; u_m uuid;
  it_breaker uuid; it_contactor uuid; it_cable uuid; it_plc uuid; it_vfd uuid; it_cabinet uuid;
  pl_sell uuid;
begin
  select p.company_id into cid
    from public.profiles p join auth.users u on u.id = p.id
    where u.email = 'mohamedbfrbrm@gmail.com';
  if cid is null then raise notice 'no company; skip'; return; end if;
  if exists (select 1 from public.brands where company_id = cid) then
    raise notice 'stock already seeded; skip'; return;
  end if;

  -- Remove the generic placeholder stock demo (seed 17) for this company.
  -- (Templates cascade to their variants; Projects/CRM demo is untouched.)
  delete from public.items where company_id = cid and sku in ('STL-001','VIS-006','BUR-100','TSH-000');
  delete from public.categories where company_id = cid and name in ('Matières premières','Produits finis','Consommables');

  -- Brands
  insert into public.brands (company_id, name) values
    (cid,'Schneider Electric'),(cid,'Siemens'),(cid,'ABB'),(cid,'Legrand'),(cid,'Phoenix Contact');
  select id into b_schneider from public.brands where company_id=cid and name='Schneider Electric';
  select id into b_siemens   from public.brands where company_id=cid and name='Siemens';
  select id into b_abb       from public.brands where company_id=cid and name='ABB';
  select id into b_legrand   from public.brands where company_id=cid and name='Legrand';
  select id into b_phoenix   from public.brands where company_id=cid and name='Phoenix Contact';

  -- Units
  insert into public.uoms (company_id, name, abbr) values
    (cid,'Unité','U'),(cid,'Mètre','m'),(cid,'Kilogramme','Kg'),(cid,'Pièce','pcs'),(cid,'Boîte','Box'),(cid,'Rouleau','Roll');
  select id into u_unit from public.uoms where company_id=cid and name='Unité';
  select id into u_m    from public.uoms where company_id=cid and name='Mètre';

  -- Warehouses
  insert into public.warehouses (company_id, name, is_group) values
    (cid,'Magasin principal',false),(cid,'Atelier',false),(cid,'Magasin chantier',false);
  select id into wh_main    from public.warehouses where company_id=cid and name='Magasin principal';
  select id into wh_atelier from public.warehouses where company_id=cid and name='Atelier';

  -- Item groups (categories) — reuse existing table; only add if absent
  insert into public.categories (company_id, name)
  select cid, x.n from (values ('Appareillage'),('Câbles'),('Automatisme'),('Armoires & coffrets'),('Accessoires')) as x(n)
  where not exists (select 1 from public.categories c where c.company_id=cid and c.name=x.n);
  select id into cat_app   from public.categories where company_id=cid and name='Appareillage';
  select id into cat_cable from public.categories where company_id=cid and name='Câbles';
  select id into cat_auto  from public.categories where company_id=cid and name='Automatisme';
  select id into cat_arm   from public.categories where company_id=cid and name='Armoires & coffrets';

  -- Items
  insert into public.items (company_id, name, sku, item_type, category_id, brand_id, stock_uom_id, uom, manufacturer, standard_buying_rate, standard_selling_rate, valuation_rate)
  values
    (cid,'Disjoncteur Compact NSX 132kW','DISJ-132','template',cat_app,b_schneider,u_unit,'Unité','Schneider Electric',45000,58000,45000),
    (cid,'Contacteur LC1D40','CONT-LC1D40','template',cat_app,b_schneider,u_unit,'Unité','Schneider Electric',8500,11000,8500),
    (cid,'Câble U1000 R2V 4x16mm²','CAB-R2V-4X16','template',cat_cable,b_legrand,u_m,'Mètre','Legrand',1200,1600,1200),
    (cid,'Automate S7-1200 CPU 1214C','PLC-S71200','template',cat_auto,b_siemens,u_unit,'Unité','Siemens',95000,125000,95000),
    (cid,'Variateur ATV320 11kW','VFD-ATV320','template',cat_auto,b_schneider,u_unit,'Unité','Schneider Electric',62000,82000,62000),
    (cid,'Coffret métallique IP55 800x600','COF-IP55','template',cat_arm,b_legrand,u_unit,'Unité','Legrand',18000,24000,18000),
    (cid,'Bornier Phoenix UT 2,5','BORN-UT25','template',cat_app,b_phoenix,u_unit,'Pièce','Phoenix Contact',180,260,180),
    (cid,'Relais de protection ABB CM','REL-ABB-CM','template',cat_app,b_abb,u_unit,'Unité','ABB',14000,19000,14000);
  select id into it_breaker  from public.items where company_id=cid and sku='DISJ-132';
  select id into it_contactor from public.items where company_id=cid and sku='CONT-LC1D40';
  select id into it_cable    from public.items where company_id=cid and sku='CAB-R2V-4X16';
  select id into it_plc      from public.items where company_id=cid and sku='PLC-S71200';
  select id into it_vfd      from public.items where company_id=cid and sku='VFD-ATV320';
  select id into it_cabinet  from public.items where company_id=cid and sku='COF-IP55';

  -- Technical specs
  insert into public.item_specs (company_id, item_id, label, value, sort_order) values
    (cid,it_breaker,'Puissance','132 KW',0),(cid,it_breaker,'Tension','400 V',1),(cid,it_breaker,'Calibre','250 A',2),
    (cid,it_plc,'Entrées/Sorties','14 DI / 10 DO',0),(cid,it_plc,'Alimentation','24 VDC',1),
    (cid,it_vfd,'Puissance','11 KW',0),(cid,it_vfd,'Tension','400 V',1),
    (cid,it_cable,'Section','4x16 mm²',0),(cid,it_cable,'Tension','1000 V',1);

  -- A template that varies on Calibre × Courbe, with generated variants
  insert into public.items (company_id, name, sku, item_type, category_id, brand_id, stock_uom_id, uom)
  values (cid,'Disjoncteur modulaire iC60','DISJ-IC60','template',cat_app,b_schneider,u_unit,'Unité');

  -- Stock entries: receipts into the main warehouse + one issue to a project
  insert into public.stock_entries (company_id, entry_type, reference) values (cid,'receipt','Réception fournisseur INIT');
  declare se uuid; begin
    select id into se from public.stock_entries where company_id=cid and reference='Réception fournisseur INIT' limit 1;
    insert into public.stock_entry_lines (company_id, stock_entry_id, item_id, qty, rate, target_warehouse_id) values
      (cid,se,it_breaker,10,45000,wh_main),
      (cid,se,it_contactor,40,8500,wh_main),
      (cid,se,it_cable,500,1200,wh_main),
      (cid,se,it_plc,6,95000,wh_main),
      (cid,se,it_vfd,8,62000,wh_main),
      (cid,se,it_cabinet,12,18000,wh_main);
  end;

  insert into public.stock_entries (company_id, entry_type, reference) values (cid,'issue','Sortie chantier station de pompage');
  declare se2 uuid; begin
    select id into se2 from public.stock_entries where company_id=cid and reference='Sortie chantier station de pompage' limit 1;
    insert into public.stock_entry_lines (company_id, stock_entry_id, item_id, qty, source_warehouse_id) values
      (cid,se2,it_cable,120,wh_main),
      (cid,se2,it_contactor,6,wh_main);
  end;

  -- Price list + a few prices
  insert into public.price_lists (company_id, name, selling) values (cid,'Tarif standard',true);
  select id into pl_sell from public.price_lists where company_id=cid and name='Tarif standard';
  insert into public.item_prices (company_id, item_id, price_list_id, rate) values
    (cid,it_breaker,pl_sell,58000),(cid,it_plc,pl_sell,125000),(cid,it_vfd,pl_sell,82000);

  -- Batch + serials for the PLC
  insert into public.batches (company_id, item_id, batch_no) values (cid,it_plc,'LOT-2026-01');
  insert into public.serial_nos (company_id, item_id, serial_no, warehouse_id) values
    (cid,it_plc,'SN-S71200-0001',wh_main),(cid,it_plc,'SN-S71200-0002',wh_main);
end $$;
