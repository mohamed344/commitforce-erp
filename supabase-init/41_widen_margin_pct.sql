-- ─────────────────────────────────────────────────────────────
-- 41 · Widen margin_pct so large margin/markup values don't overflow
--
-- migration 39 created margin_pct as numeric(5,2) (max 999.99). Entering a
-- bigger value (e.g. a markup of 6400) raised "numeric field overflow" on save.
-- Widen to numeric(8,2) (max 999 999.99) on both the live project footer and the
-- saved estimate snapshots. Idempotent: re-running re-applies the same type.
-- Run in the SQL editor of project xrjkckpchaanapyhyrbt.
-- ─────────────────────────────────────────────────────────────

alter table public.projects          alter column margin_pct type numeric(8,2);
alter table public.project_estimates  alter column margin_pct type numeric(8,2);

notify pgrst, 'reload schema';
