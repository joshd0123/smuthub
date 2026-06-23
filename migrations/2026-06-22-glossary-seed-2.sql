-- ════════════════════════════════════════════════════════════════════════
--  smutHub · glossary seed batch 2 (expanded terms)
--
--  Adds the new terms from the expanded Beginner Romantasy Glossary, plus fills
--  glossary content on existing catalog tags they map to. Editorial choices:
--   • Near-duplicates folded into one entry via also_known_as (e.g. mate-bond
--     absorbs destiny-bond / mating-bond / bonded-pair / fate-bound / mated-pair;
--     court-intrigue absorbs court-politics / royal-politics).
--   • Terms that ARE existing catalog tags get enriched in place (the INSERT
--     conflict path), so they cross-link to real books automatically.
--   • Adds one new category: 'worldbuilding' (magic systems, bonds, lore).
--
--  Idempotent: ON CONFLICT coalesce-preserves anything already written, so this
--  never clobbers edits. Prereq: 2026-06-18-glossary-fields.sql. Re-runnable.
--  After running, rebuild: node scripts/build-glossary.mjs
-- ════════════════════════════════════════════════════════════════════════

-- ── TROPES (new + enrich existing catalog tropes) ─────────────────────────
insert into tags (category, slug, label, description, voice_tagline, also_known_as) values
('trope','grumpy-sunshine','Grumpy x Sunshine',
 'A pairing of one perpetually scowling character and one relentlessly warm one — the grump goes soft only for the sunshine.',
 'He hates everyone. Except her. Especially her.', '{}'),
('trope','unrequited-love','Unrequited Love',
 'One character carries romantic feelings the other doesn''t return — at least not yet.',
 'Loving someone who hasn''t noticed. Devastating in the best way.', '{}'),
('trope','fish-out-of-water','Fish Out of Water',
 'A character dropped into an unfamiliar world, court, or culture, learning the rules in real time.',
 'New world. No manual. Everyone''s watching.', '{}'),
('trope','quest-romance','Quest Romance',
 'A romance that ignites on a dangerous journey or mission.',
 'Save the world, fall in love — ideally in that order.', '{"adventure romance"}'),
('trope','rejected-mate','Rejected Mate',
 'A fated bond that one partner refuses, at least at first — the rejection itself becomes the wound the story heals.',
 'Saying no to destiny. It does not go quietly.', '{"rejected fated mate"}'),
('trope','time-travel-romance','Time-Travel Romance',
 'Lovers separated or united across different eras.',
 'Right person. Wrong century.', '{}'),
('trope','enemy-kingdoms','Enemy Kingdoms',
 'The leads belong to warring nations, courts, or factions.',
 'Your people want my people dead. Anyway, hi.', '{}'),
('trope','training-arc','Training Arc',
 'A stretch where the protagonist is forged through structured training and earns their power.',
 'The montage chapters. Suffer now, slay later.', '{}'),
('trope','deadly-trials','Deadly Trials',
 'Characters must survive lethal tests, competitions, or challenges.',
 'Pass or die. Often both are on the menu.', '{"trials"}'),
('trope','tournament','Tournament',
 'Competitors face each other in a structured magical or martial contest.',
 'Bracket-style stakes, with feelings.', '{"tournament arc"}'),
('trope','court-intrigue','Court Intrigue',
 'Political scheming, shifting alliances, and betrayals inside a royal or fae court.',
 'Everyone''s smiling. Someone''s lying. Probably him.', '{"court politics","royal politics"}'),
('trope','royal-romance','Royal Romance',
 'Love among kings, queens, princes, and the thrones that complicate them.',
 'Crowns, duty, and one extremely inconvenient feeling.', '{}'),
('trope','rekindled-romance','Rekindled Romance',
 'Former partners who find their way back to each other after time apart.',
 'Round two. They''ve both changed. The pull hasn''t.', '{"second chance","second-chance romance"}'),
('trope','war-time-romance','Wartime Romance',
 'Love that takes root during active conflict.',
 'Falling hard while the world burns.', '{}'),
('trope','marriage-of-convenience','Marriage of Convenience',
 'Characters marry for strategy, safety, or politics — and fall in love after the paperwork.',
 'Signed the contract. Caught the feelings. Oops.', '{"political marriage"}'),
('trope','secret-royalty','Secret Royalty',
 'A character who unknowingly holds a claim to a throne, title, or power.',
 'Raised ordinary. Born to rule. Plot twist incoming.', '{"secret heir","lost heir","hidden heir"}'),
('trope','chosen-one','Chosen One',
 'A character marked by prophecy, magic, or fate for an important role.',
 'The prophecy picked you. You didn''t get a vote.', '{}'),
('trope','redemption-arc','Redemption Arc',
 'A character works to atone for past wrongs and become someone better.',
 'From villain to maybe-not. Earn it.', '{}'),
('trope','revenge','Revenge',
 'A story driven by a character''s pursuit of vengeance.',
 'Cold dish. Hot hero. Served over several hundred pages.', '{"revenge plot"}'),
('trope','snowed-in','Snowed In',
 'Characters trapped together by weather — forced proximity with a fireplace.',
 'One cabin. One storm. One bad idea that works out great.', '{}'),
('trope','road-trip','Road Trip',
 'Romance that develops while characters travel together.',
 'Close quarters, bad gas-station coffee, slow-building want.', '{}'),
('trope','monster-romance','Monster Romance',
 'A romance with a non-human or monstrous love interest.',
 'He''s got claws. And feelings. Mostly about you.', '{}'),
('trope','villain-romance','Villain Romance',
 'A romance where the love interest is the story''s antagonist — or close to it.',
 'Rooting for the bad guy. On purpose.', '{}')
on conflict (category, slug) do update set
  description   = coalesce(tags.description,   excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline),
  also_known_as = case when array_length(tags.also_known_as,1) is null then excluded.also_known_as else tags.also_known_as end;

-- ── LI ARCHETYPES (new + enrich) ──────────────────────────────────────────
insert into tags (category, slug, label, description, voice_tagline, also_known_as) values
('li-archetype','tortured','Tortured Hero',
 'A love interest carrying trauma, guilt, or scars that make intimacy a battle worth winning.',
 'Damaged, devoted, and certain he doesn''t deserve her.', '{"tortured hero"}'),
('li-archetype','golden-retriever','Golden Retriever Boyfriend',
 'A loyal, warm, openly affectionate love interest — sunshine in human form.',
 'Big heart. Bigger himbo energy. Zero games.', '{"golden retriever hero"}'),
('li-archetype','stern-brunch-daddy','Stern Brunch Daddy',
 'Older, distinguished, authoritative-but-nurturing. The look that says "I''ll order for the table and fix all your problems."',
 'Orders for the table. Handles your enemies. Devastating.', '{"sbd"}'),
('li-archetype','immortal','Immortal Love Interest',
 'A lover who has lived for centuries — and, conveniently, waited.',
 'Three hundred years of patience. Aimed entirely at you.', '{"age-old hero","immortal love interest"}'),
('li-archetype','high-lord','High Lord',
 'A powerful ruler of a magical territory or court, used to being obeyed and undone only by her.',
 'Runs a court. Could end you. Chose you instead.', '{}'),
('li-archetype','dominant','Dominant Hero',
 'A love interest who takes the lead — in the relationship and the bedroom.',
 'Decides. You''re welcome.', '{"dominant mmc"}'),
('li-archetype','morally-grey','Morally Grey Hero',
 'A hero whose ethics bend — willing to do terrible things, usually for her.',
 'Wrong by most standards. Right by hers.', '{"morally grey mmc","morally gray"}')
on conflict (category, slug) do update set
  description   = coalesce(tags.description,   excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline),
  also_known_as = case when array_length(tags.also_known_as,1) is null then excluded.also_known_as else tags.also_known_as end;

-- ── MC ARCHETYPES (new + enrich) ──────────────────────────────────────────
insert into tags (category, slug, label, description, voice_tagline, also_known_as) values
('mc-archetype','reluctant-hero','Reluctant Heroine',
 'A protagonist who resists the destiny, power, or role thrust upon her.',
 'Did not ask for the prophecy. Stuck with it anyway.', '{"reluctant heroine"}'),
('mc-archetype','fierce','Powerful Heroine',
 'A heroine with serious magical, political, or physical power — the threat, not the damsel.',
 'Not the prize. The reckoning.', '{"powerful fmc","alpha female","dominant fmc"}'),
('mc-archetype','scholar','Scholar',
 'A protagonist driven by knowledge, research, or academic obsession.',
 'Will solve the mystery and ignore the obvious crush doing so.', '{}'),
('mc-archetype','cinnamon-roll','Cinnamon Roll',
 'A gentle, sweet, kind-hearted character who is impossible to dislike.',
 'Too good for this world. Must be protected at all costs.', '{}')
on conflict (category, slug) do update set
  description   = coalesce(tags.description,   excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline),
  also_known_as = case when array_length(tags.also_known_as,1) is null then excluded.also_known_as else tags.also_known_as end;

-- ── WORLDBUILDING (NEW category — magic, bonds, lore) ─────────────────────
insert into tags (category, slug, label, description, voice_tagline, is_filterable, also_known_as) values
('worldbuilding','scry','Scry',
 'Divination using crystals, water, blood, or tokens to find people or learn secrets.',
 'Magic FaceTime, essentially.', false, '{"scrying"}'),
('worldbuilding','portal-key','Portal Key',
 'A magic-infused key that transports the bearer to a chosen place — often single-use, often pricey.',
 'Single-use teleportation. Do not lose it.', false, '{}'),
('worldbuilding','affinity','Affinity',
 'The specific type of magic a character can wield — elemental, mind-based, or esoteric.',
 'Your magical love language.', false, '{}'),
('worldbuilding','dragon-bond','Dragon Bond',
 'The magical, telepathic tether between a rider and their dragon.',
 'Permanent. Telepathic. Judges your choices.', false, '{}'),
('worldbuilding','dark-magic','Dark Magic',
 'Magic tied to death, corruption, sacrifice, or forbidden power.',
 'The kind that always has a price.', false, '{}'),
('worldbuilding','blood-oath','Blood Oath',
 'A promise sealed in blood and enforced by magic.',
 'A pinky-swear that can kill you.', false, '{}'),
('worldbuilding','mate-bond','Mate Bond',
 'The supernatural tie that marks two people as partners — by scent, fate, or magic.',
 'When the magic picks for you.', false,
 '{"destiny bond","mating bond","bonded pair","fate bound","mated pair","forced bond","true mate"}'),
('worldbuilding','affinity-magic','Magic System',
 'The rules governing how power works in a given world — its sources, costs, and limits.',
 'Every world has rules. The good ones make you pay.', false, '{"magic system"}')
on conflict (category, slug) do update set
  description   = coalesce(tags.description,   excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline),
  also_known_as = case when array_length(tags.also_known_as,1) is null then excluded.also_known_as else tags.also_known_as end;

-- ── SETTINGS / MOODS / KINKS (enrich + a couple new) ──────────────────────
insert into tags (category, slug, label, description, voice_tagline, also_known_as) values
('setting','fae-court','Fae Court',
 'A magical society ruled by fae nobility — all glamour, bargains, rivalry, and danger.',
 'Beautiful. Lethal. Terrible at honest conversation.', '{}'),
('setting','academy','Academy',
 'A school or training ground where romance brews between classes, trials, and rivalries.',
 'Magic school, but make it tense.', '{"academy romance","dragon academy"}'),
('kink','praise','Praise',
 'A dynamic where affirmation and praise are central to intimacy.',
 'Two words doing an enormous amount of work.', '{"praise kink"}'),
('mood','devastating','Gut-Wrenching',
 'A book engineered to wreck you emotionally.',
 'You will cry. Hydrate first.', '{"gut-wrenching","gut wrenching"}'),
('mood','angsty','Angst',
 'Emotional turmoil, longing, heartbreak, and internal conflict — the good pain.',
 'It hurts. That''s the point.', '{"angst"}'),
('vibe','gothic','Dark & Twisted',
 'Morally complex characters, darker themes, and sharp, unsettling conflict.',
 'Not for the faint of heart. You''ll love it.', '{"dark and twisted"}')
on conflict (category, slug) do update set
  description   = coalesce(tags.description,   excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline),
  also_known_as = case when array_length(tags.also_known_as,1) is null then excluded.also_known_as else tags.also_known_as end;

-- ── report ─────────────────────────────────────────────────────────────────
do $$
declare n_def int;
begin
  select count(*) into n_def from tags where description is not null and glossary_visible;
  raise notice 'glossary seed 2 complete → % tags now glossary-ready', n_def;
end $$;
