-- ════════════════════════════════════════════════════════════════════════
--  smutHub · normalized catalog  (books + tags + assignments, hybrid filtering)
--
--  WHAT THIS DOES
--    • Creates 3 tables: books (slug PK), tags (controlled vocabulary),
--      book_tag_assignments (the join), plus a synced books.tag_ids[] cache
--      so the public Search filters stay fast, single-table .contains() calls.
--    • Adds RLS: the public can read only status='live' books; admins read
--      and write everything.
--    • Adds an upsert_book() RPC so the CSV importer, the per-book edit form,
--      and the "★ Add to catalog" button all write through ONE consistent path
--      (book row + exploded tag assignments + synced tag_ids, in one call).
--    • Seeds the controlled-vocabulary tags.
--    • MIGRATES the existing `catalog` rows into books/tags/assignments with
--      no field lost.
--
--  HOW TO RUN  (Supabase → SQL Editor — run THIS WHOLE FILE once; safe to re-run)
--    Prerequisites already applied in your project:
--        smuthub-profiles.sql, smuthub-catalog.sql, smuthub-catalog-fields.sql
--    This script reads the existing `catalog` table but never drops or renames
--    it — your old data stays put until you choose to retire it.
--
--  NOT AUTO-RUN. Apply it yourself in Supabase, verify the row counts printed
--  at the end, then deploy the front-end. Nothing here touches config.js,
--  auth.js, the shelf table, or book_tags.
-- ════════════════════════════════════════════════════════════════════════

-- Make sure the admin flag exists (also created by smuthub-catalog.sql).
alter table profiles add column if not exists is_admin boolean default false;

-- ── helper: slug from title + author surname + year  ──────────────────────
--   e.g. ('Fourth Wing','Rebecca Yarros',2023) → 'fourth-wing-yarros-2023'
create or replace function make_slug(p_title text, p_author text, p_year int)
returns text language sql immutable as $$
  select nullif(trim(both '-' from
      regexp_replace(lower(coalesce(p_title,'')), '[^a-z0-9]+', '-', 'g')
      || case
           when coalesce(p_author,'') <> ''
           then '-' || regexp_replace(lower(regexp_replace(p_author, '^.*\s', '')), '[^a-z0-9]+', '-', 'g')
           else ''
         end
      || case when p_year is not null then '-' || p_year::text else '' end
  ), '');
$$;

-- ── helper: jsonb array → text[]  (null-safe)  ────────────────────────────
create or replace function jsonb_arr_to_text_arr(j jsonb)
returns text[] language sql immutable as $$
  select case
    when j is null or jsonb_typeof(j) <> 'array' then null
    else array(select jsonb_array_elements_text(j))
  end;
$$;

-- ── helper: canonical tag slug (lowercase-hyphenated) ─────────────────────
--   So source data with stray case/spacing ('Enemies To Lovers',
--   'beauty-and-the-beast-NEW') still matches the lowercase filter values.
create or replace function norm_tag(v text)
returns text language sql immutable as $$
  select nullif(trim(both '-' from regexp_replace(lower(coalesce(v,'')), '[^a-z0-9]+', '-', 'g')), '');
$$;

-- ════════════════════════════════════════════════════════════════════════
--  TABLES
-- ════════════════════════════════════════════════════════════════════════

create table if not exists books (
  slug              text primary key,            -- e.g. 'fourth-wing-yarros-2023'
  title             text not null,
  author            text,
  cover_url         text,                         -- Supabase Storage URL (or any host)
  -- ── bibliographic ──
  series            text,
  series_number     numeric,                      -- 1, 1.5, 2 …
  isbn              text,
  page_count        int,
  publisher         text,
  language          text default 'en',
  year              int,
  subgenre          text,                         -- romantasy | dark-romance | …
  age_category      text,                         -- YA | NA | Adult
  standalone        boolean,
  audiobook         boolean,
  blurb             text,
  -- ── spice / heat ──
  spice_level       int,                          -- 0 none · 1 sweet · 2 warm · 3 spicy · 4 hot · 5 inferno
  spice_frequency   text,                         -- none | rare | occasional | frequent | constant
  door              text,                         -- open | fade | closed  (open = on-page/explicit)
  heat_type         text[] default '{}',          -- e.g. {praise, dom-sub} headline heat descriptors
  spice_notes       text,
  -- ── reading experience / structure (single-value) ──
  energy            text,                         -- light | medium | heavy
  pacing            text,                         -- slow-burn | steady | fast
  length_feel       text,                         -- quick | standard | chonky
  pov               text,                         -- 1st/3rd · single/dual/multi
  tense             text,                         -- past | present
  mc_gender         text,
  li_gender         text,
  relationship_type text,                         -- MF | MM | FF | poly | why-choose
  who_falls_first   text,                         -- MC | LI | both | simultaneous
  love_triangle     boolean,
  ending            text,                         -- HEA | HFN | cliffhanger | tragic | ambiguous
  cliffhanger       boolean,
  time_period       text,                         -- medieval | regency | contemporary | futuristic …
  world_type        text,                         -- high-fantasy | urban-fantasy | contemporary | sci-fi …
  triggers_detail   text,
  -- ── discovery / admin ──
  comp_titles       text[] default '{}',          -- "for fans of…" (free text, not controlled)
  rating_avg        numeric,
  popularity        int default 0,
  featured          boolean default false,
  status            text default 'draft' check (status in ('draft','live','archived')),
  -- ── hybrid cache: maintained by trigger, never edited by hand ──
  tag_ids           text[] default '{}',          -- {"trope:enemies-to-lovers","mood:dark", …}
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Controlled vocabulary. Surrogate id + unique(category, slug) so the SAME
-- slug can live in two categories (e.g. trope 'morally-grey' and
-- li-archetype 'morally-grey') without colliding — this is the fix for the
-- duplicate-primary-key problem in the original spec.
create table if not exists tags (
  id          bigint generated always as identity primary key,
  category    text not null,   -- trope | mood | vibe | theme | warning | representation | setting | kink | mc-archetype | li-archetype
  slug        text not null,   -- lowercase-hyphenated, e.g. 'enemies-to-lovers'
  label       text,            -- display label, e.g. 'Enemies to Lovers'
  description text,
  created_at  timestamptz default now(),
  unique (category, slug)
);

create table if not exists book_tag_assignments (
  book_id    text   references books(slug) on delete cascade,
  tag_id     bigint references tags(id)    on delete cascade,
  source     text   default 'admin',   -- admin | migration | community
  votes      int    default 0,
  created_at timestamptz default now(),
  primary key (book_id, tag_id)
);

-- ── indexes ──
create index if not exists books_tag_ids_gin   on books using gin (tag_ids);
create index if not exists books_status_idx     on books (status);
create index if not exists books_featured_idx   on books (featured) where featured;
create index if not exists books_popularity_idx on books (popularity desc);
create index if not exists assignments_book_idx  on book_tag_assignments (book_id);
create index if not exists assignments_tag_idx   on book_tag_assignments (tag_id);

-- ════════════════════════════════════════════════════════════════════════
--  TRIGGERS — keep books.tag_ids[] in sync with the join table automatically,
--  no matter who writes (importer, edit form, manual SQL).
-- ════════════════════════════════════════════════════════════════════════

create or replace function sync_book_tag_ids(p_slug text)
returns void language sql as $$
  update books set tag_ids = coalesce((
    select array_agg(distinct (t.category || ':' || t.slug) order by (t.category || ':' || t.slug))
    from book_tag_assignments a
    join tags t on t.id = a.tag_id
    where a.book_id = p_slug
  ), '{}')
  where slug = p_slug;
$$;

create or replace function trg_sync_book_tag_ids()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform sync_book_tag_ids(old.book_id);
    return old;
  end if;
  perform sync_book_tag_ids(new.book_id);
  if tg_op = 'UPDATE' and new.book_id is distinct from old.book_id then
    perform sync_book_tag_ids(old.book_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_tag_ids on book_tag_assignments;
create trigger sync_tag_ids
  after insert or update or delete on book_tag_assignments
  for each row execute function trg_sync_book_tag_ids();

create or replace function trg_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists books_touch_updated on books;
create trigger books_touch_updated
  before update on books
  for each row execute function trg_touch_updated_at();

-- ════════════════════════════════════════════════════════════════════════
--  RLS
-- ════════════════════════════════════════════════════════════════════════
alter table books                enable row level security;
alter table tags                 enable row level security;
alter table book_tag_assignments enable row level security;

-- books: the public sees only live books; admins additionally see everything.
drop policy if exists "books public read live" on books;
create policy "books public read live" on books
  for select using (status = 'live');

drop policy if exists "books admin read all" on books;
create policy "books admin read all" on books
  for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "books admin write" on books;
create policy "books admin write" on books for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- tags & assignments: world-readable (not sensitive; the edit form needs them),
-- admin-writable.
drop policy if exists "tags public read" on tags;
create policy "tags public read" on tags for select using (true);
drop policy if exists "tags admin write" on tags;
create policy "tags admin write" on tags for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "assignments public read" on book_tag_assignments;
create policy "assignments public read" on book_tag_assignments for select using (true);
drop policy if exists "assignments admin write" on book_tag_assignments;
create policy "assignments admin write" on book_tag_assignments for all
  using      (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- ════════════════════════════════════════════════════════════════════════
--  upsert_book(jsonb) — the single write path for the front-end.
--
--    • Scalar update rule: a key PRESENT in the payload is set exactly (even to
--      null, so the edit form can clear a field); a key ABSENT is left alone.
--      The CSV importer omits blank cells → absent → preserved ("leave a cell
--      blank to skip it"); the edit form sends every field → full overwrite.
--    • Tag categories are only touched when their key is PRESENT, and then the
--      book's assignments in that category are REPLACED — so re-importing a row
--      cleanly updates its tropes/mood/etc. instead of accumulating stale ones.
--    • Accepts both new field names (spice_level, door, spice_frequency) and the
--      legacy ones (spice, open_door, steam_frequency) so old CSVs still work.
--    • Returns the book slug.
-- ════════════════════════════════════════════════════════════════════════
create or replace function upsert_book(p jsonb)
returns text language plpgsql security invoker as $$
declare
  v_slug text;
  v_map  text[][] := array[
    ['tropes','trope'], ['mood','mood'], ['vibes','vibe'], ['themes','theme'],
    ['content_warnings','warning'], ['representation','representation'],
    ['setting','setting'], ['kink_tags','kink'],
    ['mc_archetype','mc-archetype'], ['li_archetype','li-archetype']
  ];
  v_pair text[];
  v_key  text;
  v_cat  text;
begin
  if not exists (select 1 from profiles pr where pr.id = auth.uid() and pr.is_admin) then
    raise exception 'not authorized: admin only';
  end if;

  v_slug := coalesce(nullif(p->>'slug',''), make_slug(p->>'title', p->>'author', (p->>'year')::int));
  if v_slug is null then
    raise exception 'a title (and ideally author + year) is required to build a slug';
  end if;

  insert into books as b (
    slug, title, author, cover_url, series, series_number, isbn, page_count, publisher, language,
    year, subgenre, age_category, standalone, audiobook, blurb,
    spice_level, spice_frequency, door, heat_type, spice_notes,
    energy, pacing, length_feel, pov, tense,
    mc_gender, li_gender, relationship_type, who_falls_first, love_triangle,
    ending, cliffhanger, time_period, world_type, triggers_detail,
    comp_titles, rating_avg, popularity, featured, status
  ) values (
    v_slug,
    -- title is NOT NULL: a partial update omits it, so fall back to the existing
    -- row's title (the INSERT tuple is validated before ON CONFLICT resolves).
    coalesce(p->>'title', (select b2.title from books b2 where b2.slug = v_slug)),
    p->>'author', p->>'cover_url', p->>'series', (p->>'series_number')::numeric,
    p->>'isbn', (p->>'page_count')::int, p->>'publisher', coalesce(nullif(p->>'language',''),'en'),
    (p->>'year')::int, p->>'subgenre', p->>'age_category', (p->>'standalone')::boolean, (p->>'audiobook')::boolean, p->>'blurb',
    coalesce((p->>'spice_level')::int, (p->>'spice')::int),
    coalesce(nullif(p->>'spice_frequency',''),
             case lower(coalesce(p->>'steam_frequency',''))
               when 'none' then 'none' when 'low' then 'rare' when 'medium' then 'occasional'
               when 'high' then 'frequent' when 'very-high' then 'constant' else null end),
    coalesce(nullif(p->>'door',''),
             case when lower(coalesce(p->>'open_door','')) in ('true','t','yes','1') then 'open'
                  when lower(coalesce(p->>'open_door','')) in ('false','f','no','0') then 'fade' else null end),
    coalesce(jsonb_arr_to_text_arr(p->'heat_type'), '{}'),
    p->>'spice_notes',
    p->>'energy', p->>'pacing', p->>'length_feel', p->>'pov', p->>'tense',
    p->>'mc_gender', p->>'li_gender', p->>'relationship_type', p->>'who_falls_first', (p->>'love_triangle')::boolean,
    p->>'ending', (p->>'cliffhanger')::boolean, p->>'time_period', p->>'world_type', p->>'triggers_detail',
    coalesce(jsonb_arr_to_text_arr(p->'comp_titles'), '{}'),
    (p->>'rating_avg')::numeric, coalesce((p->>'popularity')::int, 0), coalesce((p->>'featured')::boolean, false),
    coalesce(case lower(nullif(p->>'status',''))
               when 'published' then 'live' when 'live' then 'live'
               when 'draft' then 'draft' when 'archived' then 'archived' else null end, 'draft')
  )
  on conflict (slug) do update set
    title             = case when p ? 'title'             then excluded.title             else b.title end,
    author            = case when p ? 'author'            then excluded.author            else b.author end,
    cover_url         = case when p ? 'cover_url'         then excluded.cover_url         else b.cover_url end,
    series            = case when p ? 'series'            then excluded.series            else b.series end,
    series_number     = case when p ? 'series_number'     then excluded.series_number     else b.series_number end,
    isbn              = case when p ? 'isbn'              then excluded.isbn              else b.isbn end,
    page_count        = case when p ? 'page_count'        then excluded.page_count        else b.page_count end,
    publisher         = case when p ? 'publisher'         then excluded.publisher         else b.publisher end,
    language          = case when p ? 'language'          then excluded.language          else b.language end,
    year              = case when p ? 'year'              then excluded.year              else b.year end,
    subgenre          = case when p ? 'subgenre'          then excluded.subgenre          else b.subgenre end,
    age_category      = case when p ? 'age_category'      then excluded.age_category      else b.age_category end,
    standalone        = case when p ? 'standalone'        then excluded.standalone        else b.standalone end,
    audiobook         = case when p ? 'audiobook'         then excluded.audiobook         else b.audiobook end,
    blurb             = case when p ? 'blurb'             then excluded.blurb             else b.blurb end,
    spice_level       = case when (p ? 'spice_level' or p ? 'spice')             then excluded.spice_level     else b.spice_level end,
    spice_frequency   = case when (p ? 'spice_frequency' or p ? 'steam_frequency') then excluded.spice_frequency else b.spice_frequency end,
    door              = case when (p ? 'door' or p ? 'open_door')                then excluded.door            else b.door end,
    heat_type         = case when p ? 'heat_type'         then excluded.heat_type         else b.heat_type end,
    spice_notes       = case when p ? 'spice_notes'       then excluded.spice_notes       else b.spice_notes end,
    energy            = case when p ? 'energy'            then excluded.energy            else b.energy end,
    pacing            = case when p ? 'pacing'            then excluded.pacing            else b.pacing end,
    length_feel       = case when p ? 'length_feel'       then excluded.length_feel       else b.length_feel end,
    pov               = case when p ? 'pov'               then excluded.pov               else b.pov end,
    tense             = case when p ? 'tense'             then excluded.tense             else b.tense end,
    mc_gender         = case when p ? 'mc_gender'         then excluded.mc_gender         else b.mc_gender end,
    li_gender         = case when p ? 'li_gender'         then excluded.li_gender         else b.li_gender end,
    relationship_type = case when p ? 'relationship_type' then excluded.relationship_type else b.relationship_type end,
    who_falls_first   = case when p ? 'who_falls_first'   then excluded.who_falls_first   else b.who_falls_first end,
    love_triangle     = case when p ? 'love_triangle'     then excluded.love_triangle     else b.love_triangle end,
    ending            = case when p ? 'ending'            then excluded.ending            else b.ending end,
    cliffhanger       = case when p ? 'cliffhanger'       then excluded.cliffhanger       else b.cliffhanger end,
    time_period       = case when p ? 'time_period'       then excluded.time_period       else b.time_period end,
    world_type        = case when p ? 'world_type'        then excluded.world_type        else b.world_type end,
    triggers_detail   = case when p ? 'triggers_detail'   then excluded.triggers_detail   else b.triggers_detail end,
    comp_titles       = case when p ? 'comp_titles'       then excluded.comp_titles       else b.comp_titles end,
    rating_avg        = case when p ? 'rating_avg'        then excluded.rating_avg        else b.rating_avg end,
    popularity        = case when p ? 'popularity'        then excluded.popularity        else b.popularity end,
    featured          = case when p ? 'featured'          then excluded.featured          else b.featured end,
    status            = case when p ? 'status'            then excluded.status            else b.status end;

  -- Replace tag assignments per category — only for categories present in payload.
  foreach v_pair slice 1 in array v_map loop
    v_key := v_pair[1]; v_cat := v_pair[2];
    if p ? v_key then
      delete from book_tag_assignments a
        using tags t
        where a.book_id = v_slug and a.tag_id = t.id and t.category = v_cat;

      if jsonb_typeof(p->v_key) = 'array' then
        insert into tags (category, slug, label)
        select v_cat, norm_tag(x.val), initcap(replace(norm_tag(x.val),'-',' '))
        from jsonb_array_elements_text(p->v_key) as x(val)
        where norm_tag(x.val) is not null
        on conflict (category, slug) do nothing;

        insert into book_tag_assignments (book_id, tag_id, source)
        select v_slug, t.id, 'admin'
        from jsonb_array_elements_text(p->v_key) as x(val)
        join tags t on t.category = v_cat and t.slug = norm_tag(x.val)
        where norm_tag(x.val) is not null
        on conflict (book_id, tag_id) do nothing;
      end if;
    end if;
  end loop;

  perform sync_book_tag_ids(v_slug);   -- belt-and-suspenders; trigger already did it
  return v_slug;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════
--  SEED — controlled vocabulary.  (Also shipped standalone in
--  2026-06-16-seed-tags.sql for re-running / extending later.)
-- ════════════════════════════════════════════════════════════════════════
insert into tags (category, slug, label) values
  -- ── tropes ──
  ('trope','enemies-to-lovers','Enemies to Lovers'),('trope','friends-to-lovers','Friends to Lovers'),
  ('trope','lovers-to-enemies','Lovers to Enemies'),('trope','rivals-to-lovers','Rivals to Lovers'),
  ('trope','fated-mates','Fated Mates'),('trope','soulmates','Soulmates'),('trope','soul-bond','Soul Bond'),
  ('trope','forced-proximity','Forced Proximity'),('trope','only-one-bed','Only One Bed'),('trope','snowed-in','Snowed In'),
  ('trope','slow-burn','Slow Burn'),('trope','instalove','Instalove'),('trope','fake-dating','Fake Dating'),
  ('trope','fake-engagement','Fake Engagement'),('trope','marriage-of-convenience','Marriage of Convenience'),
  ('trope','arranged-marriage','Arranged Marriage'),('trope','marriage-first','Marriage First'),
  ('trope','second-chance','Second Chance'),('trope','forbidden-love','Forbidden Love'),('trope','age-gap','Age Gap'),
  ('trope','grumpy-sunshine','Grumpy x Sunshine'),('trope','opposites-attract','Opposites Attract'),
  ('trope','morally-grey','Morally Grey'),('trope','villain-romance','Villain Romance'),('trope','bully-romance','Bully Romance'),
  ('trope','dark-romance','Dark Romance'),('trope','monster-romance','Monster Romance'),('trope','academy','Academy'),
  ('trope','magic-school','Magic School'),('trope','chosen-one','Chosen One'),('trope','hidden-identity','Hidden Identity'),
  ('trope','secret-royalty','Secret Royalty'),('trope','found-family','Found Family'),('trope','love-triangle','Love Triangle'),
  ('trope','reverse-harem','Reverse Harem'),('trope','why-choose','Why Choose'),('trope','masquerade','Masquerade'),
  ('trope','captive','Captive'),('trope','enemies-with-benefits','Enemies with Benefits'),
  ('trope','friends-with-benefits','Friends with Benefits'),('trope','single-parent','Single Parent'),
  ('trope','secret-baby','Secret Baby'),('trope','marriage-in-trouble','Marriage in Trouble'),
  ('trope','he-falls-first','He Falls First'),('trope','she-falls-first','She Falls First'),
  ('trope','touch-her-and-die','Touch Her and Die'),('trope','touch-starved','Touch Starved'),
  ('trope','possessive-mc','Possessive MC'),('trope','jealousy','Jealousy'),('trope','pining','Pining'),
  ('trope','slow-corruption','Slow Corruption'),('trope','redemption-arc','Redemption Arc'),('trope','revenge','Revenge'),
  ('trope','dragon-rider','Dragon Rider'),('trope','shifter','Shifter'),('trope','vampire','Vampire'),('trope','fae','Fae'),
  ('trope','demon','Demon'),('trope','angel','Angel'),('trope','witch','Witch'),('trope','necromancer','Necromancer'),
  ('trope','pirate','Pirate'),('trope','assassin','Assassin'),('trope','bodyguard','Bodyguard'),('trope','mentor','Mentor'),
  ('trope','royalty','Royalty'),('trope','mafia','Mafia'),('trope','motorcycle-club','Motorcycle Club'),
  ('trope','stalker','Stalker'),('trope','kidnapping','Kidnapping'),('trope','one-night-stand','One Night Stand'),
  ('trope','workplace-romance','Workplace Romance'),('trope','sports-romance','Sports Romance'),
  ('trope','best-friends-brother','Best Friend''s Brother'),('trope','brothers-best-friend','Brother''s Best Friend'),
  ('trope','boss-employee','Boss / Employee'),('trope','tournament','Tournament'),('trope','heist','Heist'),
  ('trope','road-trip','Road Trip'),('trope','blood-bond','Blood Bond'),('trope','telepathic-bond','Telepathic Bond'),
  ('trope','virgin-hero','Virgin Hero'),('trope','virgin-heroine','Virgin Heroine'),
  -- ── moods ──
  ('mood','dark','Dark'),('mood','cozy','Cozy'),('mood','angsty','Angsty'),('mood','emotional','Emotional'),
  ('mood','funny','Funny'),('mood','whimsical','Whimsical'),('mood','steamy','Steamy'),('mood','swoony','Swoony'),
  ('mood','action-packed','Action-Packed'),('mood','atmospheric','Atmospheric'),('mood','hopeful','Hopeful'),
  ('mood','devastating','Devastating'),('mood','lighthearted','Lighthearted'),('mood','tense','Tense'),
  ('mood','sweet','Sweet'),('mood','gritty','Gritty'),('mood','dreamy','Dreamy'),('mood','melancholic','Melancholic'),
  ('mood','playful','Playful'),('mood','intense','Intense'),
  -- ── vibes ──
  ('vibe','feral','Feral'),('vibe','unhinged','Unhinged'),('vibe','slow-and-tender','Slow & Tender'),
  ('vibe','fast-and-filthy','Fast & Filthy'),('vibe','cinematic','Cinematic'),('vibe','fairytale','Fairytale'),
  ('vibe','gothic','Gothic'),('vibe','lush','Lush'),('vibe','cold-and-brutal','Cold & Brutal'),('vibe','soft','Soft'),
  ('vibe','epic','Epic'),('vibe','intimate','Intimate'),('vibe','yearning','Yearning'),('vibe','comfort-read','Comfort Read'),
  ('vibe','escapist','Escapist'),
  -- ── themes ──
  ('theme','grief','Grief'),('theme','trauma-recovery','Trauma Recovery'),('theme','power-and-control','Power & Control'),
  ('theme','identity','Identity'),('theme','sacrifice','Sacrifice'),('theme','found-family','Found Family'),
  ('theme','coming-of-age','Coming of Age'),('theme','redemption','Redemption'),('theme','revenge','Revenge'),
  ('theme','faith','Faith'),('theme','freedom','Freedom'),('theme','duty-vs-desire','Duty vs Desire'),
  ('theme','class-divide','Class Divide'),('theme','war','War'),('theme','survival','Survival'),
  ('theme','motherhood','Motherhood'),('theme','addiction-recovery','Addiction Recovery'),('theme','self-acceptance','Self-Acceptance'),
  -- ── content warnings ──
  ('warning','sexual-assault','Sexual Assault'),('warning','abuse','Abuse'),('warning','domestic-violence','Domestic Violence'),
  ('warning','violence','Violence'),('warning','gore','Gore'),('warning','torture','Torture'),
  ('warning','death-of-loved-one','Death of a Loved One'),('warning','self-harm','Self-Harm'),('warning','suicide','Suicide'),
  ('warning','suicidal-ideation','Suicidal Ideation'),('warning','addiction','Addiction'),('warning','miscarriage','Miscarriage'),
  ('warning','pregnancy-loss','Pregnancy Loss'),('warning','kidnapping','Kidnapping'),('warning','slavery','Slavery'),
  ('warning','human-trafficking','Human Trafficking'),('warning','cheating','Cheating'),('warning','dubious-consent','Dubious Consent'),
  ('warning','non-consent','Non-Consent'),('warning','on-page-spice','On-Page Spice'),('warning','animal-harm','Animal Harm'),
  ('warning','child-harm','Child Harm'),('warning','eating-disorder','Eating Disorder'),('warning','war','War'),
  ('warning','blood','Blood'),('warning','gaslighting','Gaslighting'),('warning','stalking','Stalking'),
  ('warning','incest','Incest'),('warning','age-gap','Age Gap'),
  -- ── representation ──
  ('representation','lgbtq','LGBTQ+'),('representation','gay','Gay'),('representation','lesbian','Lesbian'),
  ('representation','bisexual','Bisexual'),('representation','pansexual','Pansexual'),('representation','transgender','Transgender'),
  ('representation','nonbinary','Nonbinary'),('representation','queer','Queer'),('representation','asexual','Asexual'),
  ('representation','demisexual','Demisexual'),('representation','bipoc','BIPOC'),('representation','black','Black'),
  ('representation','latine','Latine'),('representation','asian','Asian'),('representation','indigenous','Indigenous'),
  ('representation','disabled','Disabled'),('representation','chronic-illness','Chronic Illness'),
  ('representation','neurodivergent','Neurodivergent'),('representation','autistic','Autistic'),('representation','adhd','ADHD'),
  ('representation','plus-size','Plus Size'),('representation','mental-health','Mental Health'),
  ('representation','deaf','Deaf'),('representation','blind','Blind'),
  -- ── settings ──
  ('setting','fae-court','Fae Court'),('setting','academy','Academy'),('setting','royal-court','Royal Court'),
  ('setting','small-town','Small Town'),('setting','big-city','Big City'),('setting','boarding-school','Boarding School'),
  ('setting','college','College'),('setting','magical-school','Magical School'),('setting','kingdom','Kingdom'),
  ('setting','empire','Empire'),('setting','island','Island'),('setting','mountain','Mountain'),('setting','forest','Forest'),
  ('setting','desert','Desert'),('setting','space','Space'),('setting','spaceship','Spaceship'),('setting','dystopia','Dystopia'),
  ('setting','post-apocalyptic','Post-Apocalyptic'),('setting','underworld','Underworld'),('setting','modern-day','Modern Day'),
  ('setting','victorian-england','Victorian England'),('setting','regency-england','Regency England'),('setting','medieval','Medieval'),
  ('setting','ranch','Ranch'),('setting','military-base','Military Base'),('setting','haunted-house','Haunted House'),
  -- ── kinks ──
  ('kink','praise','Praise'),('kink','degradation','Degradation'),('kink','dom-sub','Dom/Sub'),('kink','brat-taming','Brat Taming'),
  ('kink','breeding','Breeding'),('kink','knotting','Knotting'),('kink','primal-play','Primal Play'),('kink','bondage','Bondage'),
  ('kink','spanking','Spanking'),('kink','edging','Edging'),('kink','voyeurism','Voyeurism'),('kink','exhibitionism','Exhibitionism'),
  ('kink','dirty-talk','Dirty Talk'),('kink','possessive','Possessive'),('kink','marking','Marking'),('kink','biting','Biting'),
  ('kink','size-difference','Size Difference'),('kink','multiple-partners','Multiple Partners'),('kink','public','Public'),
  ('kink','sensory-play','Sensory Play'),('kink','power-exchange','Power Exchange'),('kink','switch','Switch'),('kink','soft-dom','Soft Dom'),
  -- ── MC archetypes ──
  ('mc-archetype','fierce','Fierce'),('mc-archetype','cinnamon-roll','Cinnamon Roll'),('mc-archetype','morally-grey','Morally Grey'),
  ('mc-archetype','shy','Shy'),('mc-archetype','broody','Broody'),('mc-archetype','golden-retriever','Golden Retriever'),
  ('mc-archetype','possessive','Possessive'),('mc-archetype','villain','Villain'),('mc-archetype','alpha','Alpha'),
  ('mc-archetype','soft','Soft'),('mc-archetype','chaotic','Chaotic'),('mc-archetype','stoic','Stoic'),
  ('mc-archetype','charming','Charming'),('mc-archetype','underestimated','Underestimated'),('mc-archetype','reluctant-hero','Reluctant Hero'),
  ('mc-archetype','artist','Artist'),('mc-archetype','warrior','Warrior'),('mc-archetype','scholar','Scholar'),
  ('mc-archetype','healer','Healer'),('mc-archetype','rogue','Rogue'),('mc-archetype','leader','Leader'),('mc-archetype','caretaker','Caretaker'),
  -- ── LI archetypes ──
  ('li-archetype','golden-retriever','Golden Retriever'),('li-archetype','possessive','Possessive'),('li-archetype','broody','Broody'),
  ('li-archetype','villain','Villain'),('li-archetype','alpha','Alpha'),('li-archetype','morally-grey','Morally Grey'),
  ('li-archetype','cinnamon-roll','Cinnamon Roll'),('li-archetype','stoic','Stoic'),('li-archetype','charming','Charming'),
  ('li-archetype','protector','Protector'),('li-archetype','tortured','Tortured'),('li-archetype','dominant','Dominant'),
  ('li-archetype','soft','Soft'),('li-archetype','playful','Playful'),('li-archetype','dangerous','Dangerous'),
  ('li-archetype','devoted','Devoted'),('li-archetype','mysterious','Mysterious'),('li-archetype','arrogant','Arrogant'),
  ('li-archetype','jealous','Jealous'),('li-archetype','touch-starved','Touch Starved'),('li-archetype','warlord','Warlord'),
  ('li-archetype','king','King'),('li-archetype','prince','Prince')
on conflict (category, slug) do nothing;

-- ════════════════════════════════════════════════════════════════════════
--  DATA MIGRATION — existing `catalog` rows → books + tags + assignments.
--  Idempotent: re-running won't duplicate (on conflict do nothing throughout)
--  and won't clobber edits you make to books afterward.
-- ════════════════════════════════════════════════════════════════════════

-- 1 · books (map legacy field names; old 'published'/default → 'live')
insert into books (
  slug, title, author, cover_url, series, series_number, isbn, page_count, publisher, language,
  year, subgenre, age_category, standalone, audiobook, blurb,
  spice_level, spice_frequency, door, spice_notes,
  energy, pacing, length_feel, pov, tense,
  mc_gender, li_gender, relationship_type, who_falls_first, love_triangle,
  ending, cliffhanger, time_period, world_type, triggers_detail,
  comp_titles, rating_avg, popularity, featured, status, created_at
)
select
  make_slug(c.title, c.author, c.year), c.title, c.author, c.cover_url, c.series, c.series_number,
  c.isbn, c.page_count, c.publisher, coalesce(c.language,'en'),
  c.year, c.subgenre, c.age_category, c.standalone, c.audiobook, c.blurb,
  c.spice,
  case lower(coalesce(c.steam_frequency,''))
    when 'none' then 'none' when 'low' then 'rare' when 'medium' then 'occasional'
    when 'high' then 'frequent' when 'very-high' then 'constant' else null end,
  case when c.open_door is true then 'open' when c.open_door is false then 'fade' else null end,
  c.spice_notes,
  c.energy, c.pacing, c.length_feel, c.pov, c.tense,
  c.mc_gender, c.li_gender, c.relationship_type, c.who_falls_first, c.love_triangle,
  c.ending, c.cliffhanger, c.time_period, c.world_type, c.triggers_detail,
  coalesce(c.comp_titles,'{}'), c.rating_avg, coalesce(c.popularity,0), coalesce(c.featured,false),
  case lower(coalesce(c.status,'published'))
    when 'draft' then 'draft' when 'archived' then 'archived' else 'live' end,
  coalesce(c.created_at, now())
from catalog c
where make_slug(c.title, c.author, c.year) is not null
on conflict (slug) do nothing;

-- 2 · explode each catalog array column into tags + assignments.
--     Order: ensure the tag exists (nice label kept from the seed above via
--     "do nothing"), then attach the assignment. The trigger fills tag_ids.
do $migrate$
declare
  v_pair text[];
  v_map  text[][] := array[
    ['tropes','trope'], ['mood','mood'], ['vibes','vibe'], ['themes','theme'],
    ['content_warnings','warning'], ['representation','representation'],
    ['setting','setting'], ['kink_tags','kink'],
    ['mc_archetype','mc-archetype'], ['li_archetype','li-archetype']
  ];
  v_col text; v_cat text;
begin
  foreach v_pair slice 1 in array v_map loop
    v_col := v_pair[1]; v_cat := v_pair[2];

    -- create any missing tags from this column (canonicalized slug)
    execute format($f$
      insert into tags (category, slug, label)
      select distinct %L, norm_tag(v.val), initcap(replace(norm_tag(v.val),'-',' '))
      from catalog c, unnest(c.%I) as v(val)
      where norm_tag(v.val) is not null
      on conflict (category, slug) do nothing
    $f$, v_cat, v_col);

    -- attach assignments (source = migration)
    execute format($f$
      insert into book_tag_assignments (book_id, tag_id, source)
      select b.slug, t.id, 'migration'
      from catalog c
      join books b on b.slug = make_slug(c.title, c.author, c.year)
      cross join lateral unnest(c.%I) as v(val)
      join tags t on t.category = %L and t.slug = norm_tag(v.val)
      where norm_tag(v.val) is not null
      on conflict (book_id, tag_id) do nothing
    $f$, v_col, v_cat);
  end loop;
end
$migrate$;

-- 3 · report (check these counts after running)
do $report$
declare n_books int; n_tags int; n_assign int; n_live int;
begin
  select count(*) into n_books  from books;
  select count(*) into n_tags   from tags;
  select count(*) into n_assign from book_tag_assignments;
  select count(*) into n_live   from books where status='live';
  raise notice 'catalog migration complete → % books (% live), % tags, % tag assignments',
    n_books, n_live, n_tags, n_assign;
end
$report$;
