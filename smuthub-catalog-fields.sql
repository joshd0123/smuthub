-- ════════════════════════════════════════════════════════
--  smutHub: rich book metadata (the "45+ fields per book" set)
--  Run AFTER smuthub-catalog.sql, in Supabase → SQL Editor. Safe to re-run.
--
--  All ALTERs are additive (ADD COLUMN IF NOT EXISTS) — your existing rows and
--  covers are untouched. Populate via Supabase → Table Editor. Multi-value fields
--  are text[] arrays so you can hold many tags per book; single-value fields use
--  short controlled vocabularies (suggested values listed at the bottom).
-- ════════════════════════════════════════════════════════

-- ── Bibliographic / identity ──
alter table catalog add column if not exists series         text;
alter table catalog add column if not exists series_number numeric;        -- 1, 1.5, 2…
alter table catalog add column if not exists isbn           text;
alter table catalog add column if not exists page_count     int;
alter table catalog add column if not exists publisher      text;
alter table catalog add column if not exists language       text default 'en';
alter table catalog add column if not exists subgenre       text;          -- see vocab
alter table catalog add column if not exists standalone     boolean;       -- true = standalone, false = part of a series
alter table catalog add column if not exists audiobook      boolean;       -- audiobook edition exists
alter table catalog add column if not exists age_category   text;          -- YA | NA | Adult

-- ── Spice / heat ──
alter table catalog add column if not exists spice_notes      text;        -- free text ("slow burn, 1 explicit scene")
alter table catalog add column if not exists open_door        boolean;     -- true = on-page/explicit, false = fade-to-black
alter table catalog add column if not exists steam_frequency  text;        -- none | low | medium | high | very-high
alter table catalog add column if not exists kink_tags        text[] default '{}';

-- ── Tropes / themes / mood ──  (tropes already exists from smuthub-catalog.sql)
alter table catalog add column if not exists themes  text[] default '{}';
alter table catalog add column if not exists mood    text[] default '{}';  -- dark, cozy, angsty, funny…
alter table catalog add column if not exists vibes   text[] default '{}';  -- free, fuzzier than mood

-- ── Content / safety ──
alter table catalog add column if not exists content_warnings text[] default '{}';
alter table catalog add column if not exists triggers_detail  text;        -- specifics / notes
alter table catalog add column if not exists representation    text[] default '{}'; -- LGBTQ+, BIPOC, disabled, neurodivergent…

-- ── Reading experience ──
alter table catalog add column if not exists energy      text;   -- light | medium | heavy ("energy required")
alter table catalog add column if not exists pacing      text;   -- slow-burn | steady | fast
alter table catalog add column if not exists length_feel text;   -- quick | standard | chonky
alter table catalog add column if not exists pov         text;   -- 1st | 3rd ; single | dual | multi
alter table catalog add column if not exists tense       text;   -- past | present

-- ── Romance structure ──
alter table catalog add column if not exists mc_archetype      text[] default '{}';  -- fierce, cinnamon-roll, morally-grey…
alter table catalog add column if not exists li_archetype      text[] default '{}';  -- golden-retriever, possessive, broody, villain…
alter table catalog add column if not exists mc_gender         text;
alter table catalog add column if not exists li_gender         text;
alter table catalog add column if not exists relationship_type text;  -- MF | MM | FF | poly | reverse-harem
alter table catalog add column if not exists who_falls_first   text;  -- MC | LI | both | simultaneous
alter table catalog add column if not exists love_triangle     boolean;

-- ── Ending / outcome ──
alter table catalog add column if not exists ending      text;     -- HEA | HFN | cliffhanger | tragic | ambiguous
alter table catalog add column if not exists cliffhanger boolean;

-- ── World / setting ──
alter table catalog add column if not exists setting      text[] default '{}'; -- fae-court, academy, royal-court, small-town…
alter table catalog add column if not exists time_period  text;   -- medieval | regency | victorian | contemporary | futuristic
alter table catalog add column if not exists world_type   text;   -- high-fantasy | urban-fantasy | portal | contemporary | sci-fi
alter table catalog add column if not exists comp_titles  text[] default '{}'; -- "for fans of…"

-- ── Discovery / admin ──
alter table catalog add column if not exists rating_avg  numeric;          -- your/community average (0–5)
alter table catalog add column if not exists popularity  int default 0;    -- sort weight for browse/trending
alter table catalog add column if not exists featured    boolean default false;
alter table catalog add column if not exists status      text default 'published';  -- draft | published
alter table catalog add column if not exists updated_at  timestamptz default now();

-- ════════════════════════════════════════════════════════
--  SUGGESTED CONTROLLED VOCABULARIES (keep values consistent so filters work)
--  These are just guidance — text[] columns accept any value. Keep them
--  lowercase-hyphenated for clean filtering (e.g. 'enemies-to-lovers').
--
--  spice (int 0–5):  0 none · 1 sweet · 2 warm · 3 spicy · 4 hot · 5 inferno
--
--  tropes (100+; sample): enemies-to-lovers, friends-to-lovers, fated-mates,
--   forced-proximity, only-one-bed, slow-burn, instalove, fake-dating,
--   marriage-of-convenience, arranged-marriage, second-chance, forbidden-love,
--   age-gap, grumpy-sunshine, touch-her-and-die, morally-grey-mc, villain-romance,
--   bully-romance, academy, chosen-one, hidden-identity, secret-royalty,
--   found-family, love-triangle, reverse-harem, why-choose, soulmates,
--   masquerade, captive, enemies-with-benefits, friends-with-benefits,
--   single-parent, secret-baby, marriage-in-trouble, opposites-attract,
--   he-falls-first, she-falls-first, touch-starved, possessive-mc, jealousy,
--   pining, slow-corruption, redemption-arc, dark-romance, monster-romance,
--   dragon-rider, shifter, vampire, fae, demon, angel, witch, necromancer,
--   pirate, assassin, bodyguard, mentor, rivals-to-lovers, marriage-first…
--
--  content_warnings (sample): sexual-assault, abuse, violence, gore, torture,
--   death-of-loved-one, self-harm, suicide, addiction, miscarriage, kidnapping,
--   slavery, cheating, dubious-consent, non-consent, on-page-spice, animal-harm
--
--  mood: dark, cozy, angsty, emotional, funny, whimsical, steamy, swoony,
--   action-packed, atmospheric, hopeful, devastating, lighthearted
--
--  energy: light · medium · heavy        pacing: slow-burn · steady · fast
--  age_category: YA · NA · Adult         ending: HEA · HFN · cliffhanger · tragic
--  relationship_type: MF · MM · FF · poly · reverse-harem
--  who_falls_first: MC · LI · both · simultaneous
--  world_type: high-fantasy · urban-fantasy · portal · contemporary · sci-fi · historical
--  subgenre: fantasy-romance · paranormal-romance · sci-fi-romance · dark-romance ·
--            contemporary-romance · historical-romance · romantasy
--  mc_archetype / li_archetype: fierce, cinnamon-roll, morally-grey, shy, broody,
--   golden-retriever, possessive, villain, alpha, soft, chaotic, stoic, charming
-- ════════════════════════════════════════════════════════
