-- ════════════════════════════════════════════════════════
--  smutHub: manual ordering for the bookshelf (drag-and-drop)
--  Run in Supabase → SQL Editor. Safe to re-run.
-- ════════════════════════════════════════════════════════

-- Lower sort_order = appears earlier (top of its shelf, and first on the
-- dashboard's "Your reading"). Rows added before this migration have NULL
-- and are treated as oldest until first reordered.
alter table shelf add column if not exists sort_order integer;

create index if not exists shelf_user_sort_idx on shelf (user_id, sort_order);
