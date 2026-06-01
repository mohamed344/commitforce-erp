-- ─────────────────────────────────────────────────────────────
-- 30 · Low-stock notification threshold (per company)
--
-- The header shows a notification badge listing products whose total on-hand
-- quantity has fallen to/below a threshold. The threshold defaults to 5 in the
-- app (lib/settings.ts) and admins can change it from Settings → General.
-- NULL here means "use the app default (5)", consistent with the other
-- nullable columns on company_settings (migration 23).
-- ─────────────────────────────────────────────────────────────
alter table public.company_settings
  add column if not exists low_stock_threshold integer;

-- Guard against nonsense values (negative threshold).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'company_settings_low_stock_threshold_chk'
  ) then
    alter table public.company_settings
      add constraint company_settings_low_stock_threshold_chk
      check (low_stock_threshold is null or low_stock_threshold >= 0);
  end if;
end $$;
