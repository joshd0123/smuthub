-- ════════════════════════════════════════════════════════════════════════
--  smutHub · Tier-3 descriptions
--
--  Adds brief one-liner descriptions to the ~55 filter-only tags from
--  seed-3 so they render as proper cards on category landing pages
--  (alongside Tier 1+2 cards) — same visual treatment, just no glossary URL.
--
--  has_page stays false; these still don't get their own /glossary/<cat>/<slug>/
--  page. They appear only on /glossary/<cat>/ as cards.
--
--  Idempotent — UPDATEs only fill in null descriptions; re-running never
--  overwrites edits.
-- ════════════════════════════════════════════════════════════════════════

-- ── Heroine archetypes (Tier 3) ────────────────────────────────────────────
update tags set description = coalesce(description, 'A heroine from a lower economic background.')
  where category='mc-archetype' and slug='poor-heroine';
update tags set description = coalesce(description, 'A heroine from wealth or privilege.')
  where category='mc-archetype' and slug='rich-heroine';
update tags set description = coalesce(description, 'A heroine who obsessively follows or monitors another character.')
  where category='mc-archetype' and slug='stalker-heroine';
update tags set description = coalesce(description, 'A heroine with a fuller body type.')
  where category='mc-archetype' and slug='curvy-heroine';
update tags set description = coalesce(description, 'A heroine not characterized by exceptional beauty.')
  where category='mc-archetype' and slug='plain-heroine';
update tags set description = coalesce(description, 'A heroine notably taller than average.')
  where category='mc-archetype' and slug='tall-heroine';
update tags set description = coalesce(description, 'A female protagonist who is a teenager.')
  where category='mc-archetype' and slug='teenage-fmc';
update tags set description = coalesce(description, 'A female protagonist in her early twenties.')
  where category='mc-archetype' and slug='early-20s-fmc';
update tags set description = coalesce(description, 'A female protagonist in her thirties.')
  where category='mc-archetype' and slug='30s-fmc';
update tags set description = coalesce(description, 'A female protagonist forty or older — including centuries-old immortals.')
  where category='mc-archetype' and slug='40s-plus-fmc';
update tags set description = coalesce(description, 'A heroine of noble or royal status.')
  where category='mc-archetype' and slug='royal-heroine';
update tags set description = coalesce(description, 'A heroine involved in competitive sports.')
  where category='mc-archetype' and slug='athlete-heroine';
update tags set description = coalesce(description, 'A heroine tasked with protecting others.')
  where category='mc-archetype' and slug='bodyguard-heroine';
update tags set description = coalesce(description, 'A heroine with celebrity or public recognition.')
  where category='mc-archetype' and slug='famous-heroine';
update tags set description = coalesce(description, 'A heroine engaged in criminal activity.')
  where category='mc-archetype' and slug='criminal-heroine';
update tags set description = coalesce(description, 'A heroine who investigates mysteries.')
  where category='mc-archetype' and slug='sleuth-heroine';
update tags set description = coalesce(description, 'A heroine working as an educator or coach.')
  where category='mc-archetype' and slug='teacher-heroine';
update tags set description = coalesce(description, 'A heroine skilled in combat — sword, magic, fist, or weapon of choice.')
  where category='mc-archetype' and slug='warrior-heroine';
update tags set description = coalesce(description, 'A heroine in a professional or corporate career.')
  where category='mc-archetype' and slug='white-collar-heroine';
update tags set description = coalesce(description, 'A heroine from a labor or service profession.')
  where category='mc-archetype' and slug='working-class-heroine';

-- ── Hero archetypes (Tier 3) ───────────────────────────────────────────────
update tags set description = coalesce(description, 'A wealthy or financially powerful love interest.')
  where category='li-archetype' and slug='rich-hero';
update tags set description = coalesce(description, 'A love interest who is not fully human — fae, shifter, demon, alien.')
  where category='li-archetype' and slug='non-human-hero';
update tags set description = coalesce(description, 'A hero who obsessively follows or monitors another character.')
  where category='li-archetype' and slug='stalker-hero';
update tags set description = coalesce(description, 'A love interest with little or no prior sexual experience.')
  where category='li-archetype' and slug='virgin-hero-li';
update tags set description = coalesce(description, 'A hero working in entertainment or film.')
  where category='li-archetype' and slug='actor-hero';
update tags set description = coalesce(description, 'A professional or competitive athlete.')
  where category='li-archetype' and slug='athlete-hero';
update tags set description = coalesce(description, 'A hero tasked with protecting others.')
  where category='li-archetype' and slug='bodyguard-hero';
update tags set description = coalesce(description, 'A boxer, MMA fighter, or combat athlete.')
  where category='li-archetype' and slug='fighter';
update tags set description = coalesce(description, 'A seafaring outlaw or privateer.')
  where category='li-archetype' and slug='pirate-hero';
update tags set description = coalesce(description, 'A hero involved in government or politics.')
  where category='li-archetype' and slug='politician-hero';
update tags set description = coalesce(description, 'A hero working as an educator or coach.')
  where category='li-archetype' and slug='teacher-hero';
update tags set description = coalesce(description, 'A hero from a labor or trade profession.')
  where category='li-archetype' and slug='working-class-hero';
update tags set description = coalesce(description, 'A hero of Middle Eastern royal or noble status.')
  where category='li-archetype' and slug='sheik';

-- ── Format / Page count (Tier 3) ───────────────────────────────────────────
update tags set description = coalesce(description, 'A short book (1–149 pages) — quick reads, novellas, single-arc stories.')
  where category='format' and slug='novella';
update tags set description = coalesce(description, 'A short book (150–249 pages) — quick reads with room for a full arc.')
  where category='format' and slug='short';
update tags set description = coalesce(description, 'A standard-length book (250–399 pages) — most modern romance lives here.')
  where category='format' and slug='medium';
update tags set description = coalesce(description, 'A long book (400–599 pages) — room for worldbuilding, depth, slow burn.')
  where category='format' and slug='long';
update tags set description = coalesce(description, 'An epic-length book (600+ pages) — Sanderson, Yarros, the kind you commit to.')
  where category='format' and slug='epic';
update tags set description = coalesce(description, 'The first book of a multi-book series — sets up the world and the leads.')
  where category='format' and slug='first-in-series';
update tags set description = coalesce(description, 'A book that works as a standalone but can also kick off a series if you want more.')
  where category='format' and slug='standalone-or-first';

-- ── Tropes (Tier 3 — vague/generic) ────────────────────────────────────────
update tags set description = coalesce(description, 'War or active military conflict drives part of the story.')
  where category='trope' and slug='war';
update tags set description = coalesce(description, 'Revenge or vengeance is a major motivation in the story.')
  where category='trope' and slug='vengeance';
update tags set description = coalesce(description, 'A significant economic or social class difference exists between the leads.')
  where category='trope' and slug='class-difference';
update tags set description = coalesce(description, 'A noticeable height difference between the romantic leads.')
  where category='trope' and slug='height-difference';

-- ── Kinks (Tier 3 — niche) ─────────────────────────────────────────────────
update tags set description = coalesce(description, 'A dynamic involving age-based roleplay — consensual, negotiated between adults.')
  where category='kink' and slug='age-play';
update tags set description = coalesce(description, 'Anal sex appears on-page.')
  where category='kink' and slug='anal-sex';
update tags set description = coalesce(description, 'Sex involving unusual anatomy — non-human, magical, or fantastical body features.')
  where category='kink' and slug='creative-anatomy';
update tags set description = coalesce(description, 'Sex involving two penetrations simultaneously — common in why-choose and ménage stories.')
  where category='kink' and slug='double-penetration';
update tags set description = coalesce(description, 'A specific double-penetration variant.')
  where category='kink' and slug='double-anal';
update tags set description = coalesce(description, 'A specific double-penetration variant.')
  where category='kink' and slug='double-vaginal';
update tags set description = coalesce(description, 'A specific object, body part, or scenario plays a central role in attraction or intimacy.')
  where category='kink' and slug='fetish';
update tags set description = coalesce(description, 'A specific bedroom dynamic with a strap-on harness.')
  where category='kink' and slug='pegging';
update tags set description = coalesce(description, 'Intimacy involving sleep — negotiated, consensual roleplay.')
  where category='kink' and slug='somnophilia';
update tags set description = coalesce(description, 'A romance featuring a notably older or mature love interest.')
  where category='kink' and slug='older-mature';
update tags set description = coalesce(description, 'A romance where characters explicitly do not want children — childfree by choice.')
  where category='kink' and slug='childfree';

do $$
declare n int;
begin
  select count(*) into n from tags where description is not null and has_page = false;
  raise notice 'tier-3 descriptions complete → % filter-only tags now have descriptions for category cards', n;
end $$;
