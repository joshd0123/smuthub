-- ════════════════════════════════════════════════════════
--  smutHub: add DNF as a valid shelf status
--  Run in Supabase → SQL Editor. Safe to re-run.
-- ════════════════════════════════════════════════════════

-- The original shelf table was created without a CHECK constraint on status,
-- so any string is technically allowed today. This script ADDS an explicit
-- constraint that limits status to the four canonical values used by the UI.

alter table shelf
  drop constraint if exists shelf_status_check;

alter table shelf
  add constraint shelf_status_check
  check (status in ('want','reading','read','dnf'));
