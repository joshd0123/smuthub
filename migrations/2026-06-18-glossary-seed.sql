-- ════════════════════════════════════════════════════════════════════════
--  smutHub · glossary v1 seed
--
--  Curated 50+ entries drawn from the Beginner Romantasy Glossary draft.
--  Pairs the user's source content with voice taglines + cleanup (typos, dups).
--
--  Idempotent: on conflict updates ONLY null fields (coalesce existing first),
--  so re-running this file never overwrites anything you've edited via the
--  authoring UI or the dashboard. Safe to re-run.
--
--  Prereq: 2026-06-18-glossary-fields.sql applied. Run in Supabase → SQL Editor.
-- ════════════════════════════════════════════════════════════════════════

-- Helper: upsert a glossary entry, preserving any prior edits.
-- Idiom used throughout: `do update set field = coalesce(tags.field, excluded.field)`
-- so if the field is already populated, it stays as-is; if null, it fills in.

-- ── 1. TROPES (filterable; many cross-link to existing tag rows) ──────────
insert into tags (category, slug, label, description, voice_tagline, why_it_works, also_known_as)
values
('trope','enemies-to-lovers','Enemies to Lovers',
 'A romance in which the love interests start as antagonists — rivals, opposing sides, mutual loathing — and gradually convert that animosity into desire.',
 'They hate each other across three POVs and 400 pages until they don''t.',
 'Readers love it for the friction. Every loaded look, every cutting line is doing double duty — it''s conflict AND foreplay. The eventual surrender lands harder because the resistance was so total.',
 '{"e2l","enemies to lovers"}'),

('trope','fated-mates','Fated Mates',
 'A trope where two characters are magically, spiritually, or cosmically destined to be together — often with consequences for rejecting the bond.',
 'The "why" varies but the "inevitable" doesn''t.',
 'It strips away the question of "will they?" and replaces it with "how will they?" The tension lives in the resistance, the bond pulling at them, the magical price of saying no.',
 '{"mate bond","destined mates","true mate"}'),

('trope','forced-proximity','Forced Proximity',
 'A trope where characters who would otherwise stay apart are required by circumstance to be together — sharing a cabin, road trip, safehouse, or single room.',
 'Trapped in a tight space. Proximity = feelings. We don''t make the rules.',
 'It compresses the timeline. Walls drop. Vulnerabilities show. By the third night with no escape, every accidental touch is a referendum on the whole relationship.',
 '{"forced together","trapped together"}'),

('trope','slow-burn','Slow Burn',
 'A romance where attraction builds over a long stretch of the book — sometimes the whole book — with delayed physical resolution.',
 'The wait is exquisite. The tension is the point.',
 'Every glance is loaded because nothing has happened yet. By the time it does, the reader has been holding their breath for chapters. Maximum payoff per page.',
 '{}'),

('trope','only-one-bed','Only One Bed',
 'A setup where the characters must share a single sleeping space — by reservation error, snowstorm, hideout, or contrived circumstance.',
 'There was only one bed. There is always only one bed. That''s the whole genre.',
 'Forced intimacy in the most private way. Suddenly bedtime is a negotiation: who sleeps on the floor, who pretends to sleep, who breaks first.',
 '{"shared bed","just one bed","there was only one bed"}'),

('trope','fake-dating','Fake Dating',
 'Characters pretend to be a couple — for a wedding, a contract, family pressure — and discover the pretense is concealing real feelings.',
 'Pretending to be in love until you''re not pretending.',
 'It externalizes what the characters can''t admit internally. The "performance" lets them touch, hold hands, kiss for show — until one of them realizes they''ve stopped acting.',
 '{"fake relationship","pretend dating"}'),

('trope','friends-to-lovers','Friends to Lovers',
 'A romance that starts in established friendship and transitions into something more.',
 'They knew each other before they wanted each other. Now they''re trying to want each other AND know each other.',
 'The lower-stakes intimacy already exists — what''s new is the risk of losing everything if it doesn''t work. The vulnerability is in the question, not the answer.',
 '{}'),

('trope','morally-grey','Morally Grey',
 'A character whose ethics are flexible — capable of cruelty, manipulation, or violence, usually with a justification that makes the reader complicit.',
 'Capable of horrible things and somehow also your favorite person in the book.',
 'Pure heroes are reassuring; morally grey heroes are interesting. Readers want someone who would actually win the fight, not someone who keeps the moral high ground while losing.',
 '{"morally gray","mg","morally ambiguous"}'),

('trope','touch-her-and-die','Touch Her and You Die',
 'A possessive hero archetype where the love interest''s extreme protectiveness becomes a threat to anyone who looks sideways at the heroine.',
 'A whole personality built on "absolutely the fuck not".',
 'It''s wish-fulfilment of feeling chosen and shielded — having someone who would burn the world for you, not metaphorically.',
 '{"protective hero"}'),

('trope','dark-romance','Dark Romance',
 'A subgenre and trope where the romance involves morally compromised characters, dubious-consent dynamics, violence, captor relationships, or other content most romance shies away from.',
 'The kind your bestie will give you a look about. You will recommend it anyway.',
 'It explores attraction across power gaps and ethical lines — what would you forgive, would you survive, would you choose? The discomfort is part of the deal.',
 '{"dark","dr"}'),

('trope','he-falls-first','He Falls First',
 'A pacing trope where the male love interest realizes his feelings well before the heroine does.',
 'He''s gone in chapter three. She''s in denial until chapter twenty-two.',
 'Reverses the default. Reader sees his quiet devotion building while she misses every signal. The dramatic irony is the whole appeal.',
 '{"he fell first"}'),

('trope','she-fell-harder','She Fell Harder',
 'A companion pacing trope: when "he fell first" lands, her eventual feelings arrive with more force.',
 'He fell first. She fell harder. Both of them are not okay.',
 'It rebalances the imbalance. Now they''re both in deep — just on different timelines.',
 '{"she falls harder"}'),

('trope','mutual-pining','Mutual Pining',
 'Both characters are in love with each other but neither has said it — sometimes neither has admitted it to themselves.',
 'Two people thinking "they would never feel that way about me" about each other. Simultaneously. For 350 pages.',
 'It''s yearning in stereo. Every reader knows what the characters don''t. The release when they finally admit it is half the catharsis of the genre.',
 '{"mutual pining","mutual yearning"}'),

('trope','true-mate','True Mate',
 'A shifter/paranormal variation of fated mates — the destined partner, often recognized by scent or the shifter''s animal side, sometimes distinguished from a "chosen mate" picked by logic rather than fate.',
 'When your wolf knows before you do.',
 'Adds biological certainty to the fated-mates fantasy. The body picks; the mind catches up.',
 '{"destined mate"}'),

('trope','shadow-daddy','Shadow Daddy',
 'A hero archetype: intimidating, dark, often morally grey, with shadow- or void-based magical abilities; possessive and devoted to his love interest.',
 'Tall. Brooding. Made of literal darkness. Will commit crimes for her.',
 'It''s morally grey with paranormal aesthetics. The shadows are doing emotional work — they''re a visual shorthand for everything dangerous and protective the reader wants in one character.',
 '{"shadow daddy"}'),

('trope','virgin-hero','Virgin Hero',
 'A male love interest who hasn''t had sex before the events of the book.',
 'He''s 300 years old and waited. For her. Specifically.',
 'Subverts the rake archetype. Adds patience, fixation, and the inversion of the "experienced rake / inexperienced heroine" dynamic that romance defaulted to for decades.',
 '{"virginal hero","inexperienced hero"}')
on conflict (category, slug) do update set
  description    = coalesce(tags.description,    excluded.description),
  voice_tagline  = coalesce(tags.voice_tagline,  excluded.voice_tagline),
  why_it_works   = coalesce(tags.why_it_works,   excluded.why_it_works),
  also_known_as  = case when array_length(tags.also_known_as,1) is null then excluded.also_known_as else tags.also_known_as end,
  origin_note    = coalesce(tags.origin_note,    excluded.origin_note);

-- shadow-daddy gets an origin note (the only trope row with one in v1).
-- Kept as a separate UPDATE so the trope INSERT stays a clean 7-column block.
update tags set origin_note = coalesce(origin_note,
  'The term exploded on BookTok around the rise of fae romantasy — Rhysand, Azriel, Xaden — and now applies to any romantasy LI whose magic involves shadow, void, or darkness.')
where category='trope' and slug='shadow-daddy';

-- ── 2. SUBGENRES (new category; some filterable some not) ─────────────────
insert into tags (category, slug, label, description, voice_tagline, why_it_works, is_filterable)
values
('subgenre','romantasy','Romantasy',
 'A genre that blends fantasy and romance — magical worlds and significant worldbuilding with a central love story driving the plot.',
 'Fantasy with a love story that''s NOT the side quest.',
 'It''s the fastest-growing genre in fiction because it doesn''t make readers choose. World-saving stakes AND who-do-you-pick stakes, every chapter, simultaneously.',
 true),

('subgenre','contemporary-romance','Contemporary Romance',
 'Romance set in the present-day real world — no magic, no time travel, just modern people falling in love.',
 'Romance without the dragons. Sometimes you need a Tuesday.',
 'When you want the swoon without the worldbuilding tax. Lower barrier to entry, higher relatability, often peak rom-com energy.',
 true),

('subgenre','paranormal-romance','Paranormal Romance',
 'Romance with supernatural elements — vampires, shifters, witches, fae, demons, ghosts.',
 'Romance, but make him fanged / furred / fae.',
 'Externalizes desire into the magical. The character can''t just want her — he hungers, he burns, he marks. Subtlety is not the goal.',
 true),

('subgenre','urban-fantasy','Urban Fantasy',
 'Fantasy set in a contemporary, usually urban setting — magic in the modern world.',
 'There''s a fae court under the subway and you''re late for work.',
 'Familiar world, unfamiliar rules. Lets readers project magic onto their own city while keeping the conflict grounded.',
 true),

('subgenre','historical-romance','Historical Romance',
 'Romance set in the past — Regency, Victorian, medieval, or any historical period.',
 'Ballrooms, longing, and far too many waistcoats.',
 'Constraints generate tension. Reputation, scandal, arranged marriages — the era is the obstacle course, the chemistry is the prize.',
 true),

('subgenre','dark-romance','Dark Romance',
 'A romance subgenre that leans into morally compromised characters, dubious or non-consent dynamics, violence, and content that pushes past the comfort zone of mainstream romance.',
 'Trigger-warning territory by design.',
 'Some readers want clean fantasy; some want to interrogate their own discomfort. Both are legitimate, and both should know what shelf they''re on.',
 true)
on conflict (category, slug) do update set
  description    = coalesce(tags.description,    excluded.description),
  voice_tagline  = coalesce(tags.voice_tagline,  excluded.voice_tagline),
  why_it_works   = coalesce(tags.why_it_works,   excluded.why_it_works);

-- ── 3. MECHANICS (door/spice/burn — glossary-only for most) ───────────────
insert into tags (category, slug, label, description, voice_tagline, is_filterable)
values
('mechanics','spice','Spice (Heat Level)',
 'A reader-shorthand rating for how explicit a book''s sexual content is, usually on a 0–5 chili-pepper scale.',
 'Zero to inferno. Hydrate accordingly.',
 false),

('mechanics','open-door','Open Door',
 'Romance where sex scenes are shown explicitly on the page.',
 'Curtains: open. Lights: dim. Detail: extensive.',
 false),

('mechanics','closed-door','Closed Door',
 'Romance where sex happens but isn''t shown — fade-to-black, morning-after framing, imagination filling the gap.',
 'The door is shut. Your imagination is doing the heavy lifting.',
 false),

('mechanics','fade-to-black','Fade to Black',
 'A scene that cuts away just before or during a sexual encounter — the close-door convention in action.',
 'And scene.',
 false),

('mechanics','burn','Burn',
 'A descriptor for how fast a romance develops sexually — distinct from "slow-burn" the trope. A book can be "fast-burn" (immediate heat) or "slow-burn" (delayed).',
 'How hot, how fast.',
 false),

('mechanics','smut','Smut',
 'Affectionate shorthand for explicit sexual content in romance.',
 'The good stuff. We''re all adults here.',
 false),

('mechanics','d-s','D/s (Dominance / Submission)',
 'A power-exchange dynamic — bedroom or 24/7 — where one partner takes control and one yields. Consensual is the only kind that counts.',
 'Negotiated, not assumed.',
 false),

('mechanics','safe-word','Safe Word',
 'An agreed-upon word that immediately stops a scene in kink contexts. Non-negotiable infrastructure for consent.',
 'The single most romantic word in BDSM romance.',
 false),

('mechanics','high-spice','High Spice',
 'Romance with very explicit sexual content — typically 4–5 chilis on smutHub''s scale.',
 'Read in a private room. Hydrate. Maybe close the blinds.',
 false)
on conflict (category, slug) do update set
  description   = coalesce(tags.description,   excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline);

-- ── 4. FORMAT (POV + book structure; glossary-only) ──────────────────────
insert into tags (category, slug, label, description, voice_tagline, is_filterable)
values
('format','pov','POV (Point of View)',
 'The character whose perspective the reader experiences. Romantasy is largely written in 1st-person POV; multi-POV is common in epic romantasy.',
 'Whose head you''re in.',
 false),

('format','dual-pov','Dual POV',
 'A story alternates between two characters'' perspectives — usually the main love interests.',
 'Both their secrets. Both their pining. You know what they''re not saying out loud.',
 false),

('format','single-pov','Single POV',
 'The story is told from one character''s perspective — usually the protagonist.',
 'One head. One voice. Discover them when she does.',
 false),

('format','first-person-pov','First-Person POV',
 'Narrated as "I felt," "I knew" — placing the reader fully inside one character.',
 'Maximum intimacy with one set of thoughts. Maximum bias too.',
 false),

('format','third-person-pov','Third-Person POV',
 'Narrated as "she did," "he knew" — a step outside the character with more flexibility to show multiple perspectives.',
 'Camera-over-the-shoulder rather than inside the skull.',
 false),

('format','duet','Duet',
 'A story told across two books, often one POV each, or one continuous arc split in two.',
 'Two books, one story. Buy them together.',
 false),

('format','trilogy','Trilogy',
 'A three-book story arc.',
 'Threes. Build, turn, resolve. Or build, turn, leave-everyone-shattered.',
 false),

('format','standalone','Standalone',
 'A complete story in a single book — no cliffhanger, no required reading after it.',
 'Beginning, middle, end. No homework.',
 false),

('format','series','Series',
 'Multiple connected books, either one continuous story or interconnected characters in a shared world.',
 'A bigger story than one book could hold.',
 false),

('format','interconnected-series','Interconnected Series',
 'Standalones that share a world or supporting cast but can be read independently. Previous protagonists often cameo.',
 'Standalones in a shared world. Read in any order. Couples cameo.',
 false),

('format','no-cliffhanger','No Cliffhanger',
 'A book that resolves its central arc rather than leaving readers waiting for the next installment.',
 'Complete in one. No emotional debt.',
 false)
on conflict (category, slug) do update set
  description   = coalesce(tags.description,   excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline);

-- ── 5. CULTURE (reader jargon, abbreviations, character roles, endings) ──
insert into tags (category, slug, label, description, voice_tagline, also_known_as, is_filterable)
values
('culture','booktok','BookTok',
 'The romance and romantasy corner of TikTok — primary recommendation engine and discovery surface for the genre since ~2020.',
 'Where the spice rec lives.',
 '{}', false),

('culture','tbr','TBR',
 'To Be Read — your reading list. Never shrinks. Only grows.',
 'A monument to optimism.',
 '{"to be read"}', false),

('culture','dnf','DNF',
 'Did Not Finish — a book you stopped reading. No judgment; not every book is for every reader.',
 'Move on. Life''s too short.',
 '{"did not finish"}', false),

('culture','arc','ARC',
 'Advance Reader Copy — a free pre-publication copy given to reviewers, BookTokers, and bookstagrammers in exchange for an honest review.',
 'How the genre''s hype machine works.',
 '{"advance reader copy"}', false),

('culture','kindle-unlimited','Kindle Unlimited (KU)',
 'Amazon''s ebook subscription service. Many indie romance authors are KU-exclusive, which is why a lot of the genre lives there.',
 'Where indie romance authors live.',
 '{"ku","kindle unlimited"}', false),

('culture','book-boyfriend','Book Boyfriend',
 'A fictional hero you''re emotionally attached to.',
 'Symptoms include: thinking about him at work, comparing real people to him unfavorably, no regrets.',
 '{}', false),

('culture','book-hangover','Book Hangover',
 'The inability to start a new book because you''re still emotionally compromised by the last one.',
 'You read a great book. You will not be available for new fiction for 72 hours.',
 '{}', false),

('culture','otp','OTP',
 'One True Pairing — the couple you''re ride-or-die for in a book, series, or fandom.',
 'Jack to your Rose, but happier.',
 '{"one true pairing"}', false),

('culture','ott','OTT',
 'Over the Top — used affectionately for heroes who are theatrical in their devotion: grand gestures, possessiveness, obsession (consensual).',
 'Subtlety not included. Subtlety not requested.',
 '{"over the top"}', false),

('culture','ofy','OFY',
 'Obsessed For You — extreme devotion from a love interest. Distinct from creepy by being mutual and (mostly) wanted.',
 'He thinks about her. Constantly. By design.',
 '{"obsessed for you"}', false),

('culture','mce','Main Character Energy',
 'When a character commands their own story — presence, agency, the protagonism reader-immersion runs on.',
 'You are the protagonist. Act like it.',
 '{"main character energy"}', false),

('culture','snort-laugh','Snort-Laugh',
 'The unflattering laugh a book surprises out of you. Sign of high quality. Frequently happens in public.',
 'Undignified. Diagnostic of a good book.',
 '{}', false),

('culture','yearning','Yearning',
 'The painful longing between characters who haven''t come together (or have, and now can''t).',
 'The genre''s primary emotion.',
 '{}', false),

('culture','red-flag-parade','Red Flag Parade',
 'A character who is nothing but red flags. Often said affectionately.',
 'Every flag is red. Reader is going in anyway.',
 '{}', false),

('culture','grey-sweatpants','Grey Sweatpants',
 'A piece of clothing with disproportionate cultural significance in romance reader spaces.',
 'You know why.',
 '{}', false),

('culture','good-girl','Good Girl',
 'Praise used in intimate contexts. The two-word phrase doing the most heavy lifting in modern romance.',
 'Two words. A whole subgenre.',
 '{}', false),

('culture','indie-author','Indie Author',
 'Self-published authors — increasingly the engine of romance''s output and innovation, especially in romantasy and dark romance.',
 'Where the most adventurous stuff in the genre lives.',
 '{"independent author","self-published"}', false),

('culture','wip','WIP',
 'Work in Progress — a book the author is currently writing.',
 'The thing the author tweets about and you stalk updates on.',
 '{"work in progress"}', false),

('culture','li','LI',
 'Love Interest — the romantic counterpart to the main character.',
 'Whoever the FMC is falling for.',
 '{"love interest"}', false),

('culture','fmc','FMC',
 'Female Main Character — the heroine.',
 'Whose head you''re probably in.',
 '{"female main character"}', false),

('culture','mmc','MMC',
 'Male Main Character — the hero, often the love interest in MF romance.',
 'Tall. Probably broody. Definitely problematic.',
 '{"male main character"}', false),

('culture','trope','Trope',
 'A recurring story element or device. NOT a cliché — tropes are the whole reason we''re here.',
 'The thing that''s on the back of the book that made you buy it.',
 '{}', false),

('culture','hea','HEA',
 'Happily Ever After — the couple ends up together and committed. The genre''s baseline promise.',
 'The contract. Romance promises this.',
 '{"happily ever after"}', false),

('culture','hfn','HFN',
 'Happily For Now — the couple is together and happy, but the future isn''t fully defined. Still a positive ending.',
 'Happy. Just not contractually forever.',
 '{"happily for now"}', false),

('culture','mf','MF',
 'A male / female pairing.',
 'Genre default. The most common pairing.',
 '{"male female"}', false),

('culture','mm','MM',
 'A male / male pairing.',
 'Two men. The MM romance corner is huge and thriving.',
 '{"male male"}', false),

('culture','ff','FF',
 'A female / female pairing.',
 'Two women. Often labeled WLW (women loving women).',
 '{"female female","wlw","women loving women"}', false),

('culture','wc','Why Choose',
 'A polyamorous trope where the protagonist doesn''t pick — they get all the love interests.',
 'Why choose? Exactly.',
 '{"why choose","reverse harem","rh"}', false),

('culture','mmf','MMF',
 'A pairing of two men and one woman that INCLUDES male/male contact between the men.',
 'Three people. All paired with each other.',
 '{"male male female"}', false),

('culture','mfm','MFM',
 'A pairing of two men and one woman where the men are involved with the woman but NOT each other.',
 'Three people. Two of them aren''t touching.',
 '{"male female male"}', false)
on conflict (category, slug) do update set
  description   = coalesce(tags.description,   excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline),
  also_known_as = case when array_length(tags.also_known_as,1) is null then excluded.also_known_as else tags.also_known_as end;

-- ── 6. OMEGAVERSE & SHIFTER MECHANICS ────────────────────────────────────
insert into tags (category, slug, label, description, voice_tagline, why_it_works, is_filterable)
values
('omegaverse','omegaverse','Omegaverse',
 'A romance worldbuilding system featuring biological designations — Alphas (rut), Omegas (heat), Betas (neutral) — with knotting, scent-bonding, mate dynamics, and often mpreg. Distinct from basic shifter pack romance though they often overlap.',
 'A/B/O dynamics, bio-mate magic, and very dedicated readers.',
 'It externalizes desire into biology. Bodies don''t ask permission of personalities — heat and rut force feelings out. Polarizing but fiercely loved.',
 false),

('omegaverse','alpha','Alpha',
 'In omegaverse: the designation that experiences ruts, knots, and often projects dominance. Personality varies — not all alphas are alphaholes.',
 'Designation, not personality.',
 null, false),

('omegaverse','omega','Omega',
 'In omegaverse: the designation that experiences heats, can be knotted, often bears young regardless of gender. Not inherently submissive — personality varies.',
 'Designation, not personality.',
 null, false),

('omegaverse','heat','Heat',
 'In omegaverse: a biological cycle where Omegas experience intense drive to mate. Usually requires an Alpha or suppressants to manage. Distinct from "heat level" (spice rating).',
 'Not the spice rating. The biological cycle. Different heat.',
 null, false),

('omegaverse','knotting','Knotting',
 'A canine/wolf-derived mating mechanic in omegaverse and shifter romance where the Alpha "knots" during sex, physically bonding the pair.',
 'Look it up. We won''t spell it out.',
 null, false),

('omegaverse','suppressants','Suppressants',
 'In omegaverse: medication that suppresses heats or ruts. Lets characters function "normally" but often has plot-relevant side effects or failures.',
 'Goes off the suppressants in Chapter 14. The plot starts in Chapter 14.',
 null, false),

('omegaverse','mpreg','Mpreg',
 'Male pregnancy — common in omegaverse where male Omegas can carry young. A whole subgenre with dedicated readers.',
 'A subgenre, not a typo.',
 null, false),

('omegaverse','scent-marking','Scent Marking',
 'In shifter and omegaverse romance: leaving your scent on a mate to claim them. Ranges from subtle (a press of the wrist) to primal.',
 'Possessive. Subtle to extreme. Always meaningful.',
 null, false),

('omegaverse','shifting','Shifting',
 'The transformation between human and animal forms. Painful or seamless depending on the world. Some can partial-shift (claws, eyes). Often tied to emotion, the moon, or choice.',
 'When the wolf comes out.',
 null, false)
on conflict (category, slug) do update set
  description   = coalesce(tags.description,   excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline),
  why_it_works  = coalesce(tags.why_it_works,  excluded.why_it_works);

-- ── 7. Fill content for existing seed tags that match the user's glossary ──
-- These already exist in the catalog as tag rows (from the original seed);
-- we're filling in their glossary content without re-inserting.

update tags set
  description    = coalesce(description,    'Magical beings associated with fairy lore — tall, often pointed-eared, otherworldly in beauty, frequently organized into magical courts with their own powers and politics.'),
  voice_tagline  = coalesce(voice_tagline,  'They look like that AND have shadow magic. It''s not fair.'),
  why_it_works   = coalesce(why_it_works,   'The fae deliver romantasy''s purest fantasy: beautiful, dangerous, magical, ruled by their own laws of bargains and bonds. Reader gets immortality, alien morality, and a court system designed for high-stakes politics — all wrapped around a love story.')
where category='trope' and slug='fae';

update tags set
  description    = coalesce(description,    'Romance featuring characters who shift between human and animal forms — wolves and dragons most common, but anything from big cats to bears. Often includes pack dynamics and mate bonds.'),
  voice_tagline  = coalesce(voice_tagline,  'The wolf knows what the human won''t admit.'),
  why_it_works   = coalesce(why_it_works,   'Two bodies = two voices. The animal side cuts past hesitation: it knows, it claims, it protects. The human side handles the complication.')
where category='trope' and slug='shifter';

update tags set
  description    = coalesce(description,    'A trope where the male love interest is a dragon rider — usually in an academy or military setting, with a soul-bonded dragon and a high-stakes magical war as the backdrop.'),
  voice_tagline  = coalesce(voice_tagline,  'Dragon. Rider. War college. Yes.'),
  why_it_works   = coalesce(why_it_works,   'It bundles three irresistible elements: chosen-one rider mythology, the bonded-animal intimacy of fantasy, and academy / military stakes. Fourth Wing didn''t invent this combination — it perfected it.')
where category='trope' and slug='dragon-rider';

update tags set
  description    = coalesce(description,    'Two characters magically or spiritually bonded — sometimes telepathically, sometimes through ritual, sometimes by birth.'),
  voice_tagline  = coalesce(voice_tagline,  'A connection neither can escape, both are scared of, and the reader is here for.')
where category='trope' and slug='soulmates';

update tags set
  description    = coalesce(description,    'A character who is biologically or magically destined to be the partner of another — without the lifelong commitment implication of "mate."'),
  voice_tagline  = coalesce(voice_tagline,  'Pulled toward each other before either has a say.')
where category='trope' and slug='soul-bond';

-- ── Final report ─────────────────────────────────────────────────────────
do $$
declare n_with_def int; n_total int; n_filterable int;
begin
  select count(*) into n_total       from tags;
  select count(*) into n_with_def    from tags where description is not null;
  select count(*) into n_filterable  from tags where is_filterable;
  raise notice 'glossary seed complete → % tags, % with descriptions (glossary-ready), % filterable',
    n_total, n_with_def, n_filterable;
end $$;
