-- ════════════════════════════════════════════════════════════════════════
--  smutHub · tag knowledge-graph (ADDITIVE upgrade)
--
--  Reconciles the "tags as first-class knowledge graph" brief with what's
--  already built + LIVE. ADOPTS the safe, valuable parts; REJECTS the parts
--  that would break the live site (documented in migrations/TAG-GRAPH.md):
--
--    ✓ tag_relations join table (editorial similar / paired / opposite links)
--    ✓ a few roadmap columns on tags (seo_description, priority, etc.)
--    ✓ an ADDITIVE authors table (future author pages) — does NOT touch books.author
--
--    ✗ NOT changing tags.id to a text slug PK — 30+ slugs live in multiple
--      categories (morally-grey, dark-romance, alpha, possessive…). The surrogate
--      bigint id + unique(category,slug) is load-bearing. Keep it.
--    ✗ NOT collapsing to 7 categories — would rewrite every LIVE glossary URL.
--    ✗ NOT migrating books.author → FK — high blast radius; deferred to its own
--      snapshot-first effort.
--
--  Everything here is additive + idempotent + safe to re-run. NOT auto-run —
--  apply in Supabase → SQL Editor when ready. Nothing changes on the live site
--  until you also re-run the glossary build.
-- ════════════════════════════════════════════════════════════════════════

-- Reuse the updated_at touch trigger fn (created by the catalog migration;
-- re-declared here so this file is self-contained).
create or replace function trg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

-- ── 1. Roadmap / SEO columns on tags (all optional) ────────────────────────
alter table tags add column if not exists seo_description   text;   -- ~155-char search snippet, distinct from the on-page definition
alter table tags add column if not exists priority          int default 50;  -- 1–100, ordering for the "which tags get rich content" roadmap
alter table tags add column if not exists search_volume_note text;  -- 'high' | 'medium' | 'low' | free notes
alter table tags add column if not exists emoji             text;   -- per-tag emoji override (build falls back to the category emoji)
alter table tags add column if not exists updated_at        timestamptz default now();

drop trigger if exists tags_touch_updated on tags;
create trigger tags_touch_updated before update on tags
  for each row execute function trg_touch_updated_at();

create index if not exists tags_priority_idx on tags (priority desc);

comment on column tags.seo_description is 'Optional ~155-char meta description for the tag''s glossary page. If null, the build uses the definition.';
comment on column tags.priority        is '1–100 roadmap priority — which tags earn rich (why_it_works / origin_note) treatment first.';

-- ── 2. tag_relations — the actual knowledge graph ──────────────────────────
-- Editorial links between tags. References the surrogate bigint tags.id (NOT
-- slug — slugs aren''t unique across categories). Relation types:
--   'similar'      same vibe, swap-friendly
--   'often-paired' commonly co-occur (fated-mates + dragon-rider)
--   'parent'       broader concept (romance > romantasy)
--   'child'        narrower concept (romantasy < romance)
--   'opposite'     antonyms (open-door vs closed-door)
create table if not exists tag_relations (
  tag_id         bigint references tags(id) on delete cascade,
  related_tag_id bigint references tags(id) on delete cascade,
  relation_type  text not null default 'similar',
  strength       int  not null default 5,   -- 1–10, higher = stronger / shown first
  created_at     timestamptz default now(),
  primary key (tag_id, related_tag_id),
  check (tag_id <> related_tag_id)
);
create index if not exists tag_relations_tag_idx on tag_relations (tag_id);

alter table tag_relations enable row level security;
drop policy if exists "tag_relations public read" on tag_relations;
create policy "tag_relations public read" on tag_relations for select using (true);
drop policy if exists "tag_relations admin write" on tag_relations;
create policy "tag_relations admin write" on tag_relations for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ── 3. link_tags() — friendly bidirectional authoring (no admin UI needed) ──
-- Adds a relation BOTH directions in one call. similar/often-paired/opposite are
-- symmetric (same type both ways); parent/child are inverses of each other.
--   select link_tags('trope','fated-mates','trope','dragon-rider','often-paired',7);
--   select link_tags('mechanics','open-door','mechanics','closed-door','opposite',8);
create or replace function link_tags(
  p_cat_a text, p_slug_a text,
  p_cat_b text, p_slug_b text,
  p_rel text default 'similar',
  p_strength int default 5
) returns text language plpgsql security invoker as $$
declare a bigint; b bigint; inv text;
begin
  select id into a from tags where category = p_cat_a and slug = p_slug_a;
  select id into b from tags where category = p_cat_b and slug = p_slug_b;
  if a is null then raise exception 'tag not found: %/%', p_cat_a, p_slug_a; end if;
  if b is null then raise exception 'tag not found: %/%', p_cat_b, p_slug_b; end if;

  insert into tag_relations (tag_id, related_tag_id, relation_type, strength)
    values (a, b, p_rel, p_strength)
    on conflict (tag_id, related_tag_id) do update set relation_type = excluded.relation_type, strength = excluded.strength;

  inv := case p_rel when 'parent' then 'child' when 'child' then 'parent' else p_rel end;
  insert into tag_relations (tag_id, related_tag_id, relation_type, strength)
    values (b, a, inv, p_strength)
    on conflict (tag_id, related_tag_id) do update set relation_type = excluded.relation_type, strength = excluded.strength;

  return p_slug_a || ' ↔ ' || p_slug_b || ' (' || p_rel || ')';
end $$;

-- ── 4. authors — ADDITIVE first-class entity (future author pages) ─────────
-- Created and populated from existing book authors. Crucially: this does NOT
-- alter books.author. Nothing reads this table yet — it's groundwork so author
-- pages later are trivial, with zero risk to the live catalog.
create table if not exists authors (
  id          text primary key,        -- slug, e.g. 'rebecca-yarros'
  name        text not null,
  bio         text,
  website     text,
  social      jsonb,                    -- {instagram, tiktok, twitter, …}
  created_at  timestamptz default now()
);
create index if not exists authors_name_gin on authors using gin (to_tsvector('english', name));

alter table authors enable row level security;
drop policy if exists "authors public read" on authors;
create policy "authors public read" on authors for select using (true);
drop policy if exists "authors admin write" on authors;
create policy "authors admin write" on authors for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- Populate from distinct book authors (norm_tag gives the slug; collisions keep
-- the first via on conflict do nothing). Re-running picks up any new authors.
insert into authors (id, name)
select norm_tag(a.author), a.author
from (select distinct author from books where coalesce(author,'') <> '') a
where norm_tag(a.author) is not null
on conflict (id) do nothing;

-- ── report ─────────────────────────────────────────────────────────────────
do $$
declare n_rel int; n_auth int;
begin
  select count(*) into n_rel  from tag_relations;
  select count(*) into n_auth from authors;
  raise notice 'tag-graph migration complete → tag_relations ready (% rows), authors seeded (% from books)', n_rel, n_auth;
end $$;
