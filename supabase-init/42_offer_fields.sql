-- ─────────────────────────────────────────────────────────────
-- 42 · Offer/facture header fields on the project
--
-- The final document (offre financière / facture) needs an offer reference,
-- a validity ("valable 30 jours" / a date) and free-text remarks — the bottom
-- box of the chiffrage workflow. Stored on the project (live) and frozen into
-- project_estimates.snapshot when an estimate is saved. Idempotent.
-- Run in the SQL editor of project xrjkckpchaanapyhyrbt.
-- ─────────────────────────────────────────────────────────────

alter table public.projects add column if not exists offer_ref      text;
alter table public.projects add column if not exists offer_validity text;
alter table public.projects add column if not exists offer_notes    text;

notify pgrst, 'reload schema';
