-- ════════════════════════════════════════════════════════════════════════
--  smutHub · glossary seed batch 3 (THE BIG ONE)
--
--  Adds ~200 terms from the expanded Notion glossary, categorized into our
--  schema and tier-flagged:
--    Tier 1+2 (has_page=true)  — get their own /glossary/<cat>/<slug>/ page
--    Tier 3   (has_page=false) — filter tags only, no glossary URL
--
--  Categories used (existing + new):
--    NEW: time-period, sport
--    EXISTING: trope, mood, vibe, theme, subgenre, worldbuilding, setting,
--              mechanics, format, pov, culture, omegaverse, kink,
--              mc-archetype, li-archetype, representation, warning
--
--  Idempotent: on conflict (category,slug) coalesce-preserves prior content.
--  Prereq: 2026-06-22-tier-flag.sql. After running: rebuild glossary.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. SUBGENRES (Tier 2 — definition pages) ──────────────────────────────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('subgenre','fantasy','Fantasy',
 'A story featuring magical or supernatural elements as central to the world or plot.', true, true),
('subgenre','high-fantasy','High Fantasy',
 'Fantasy set in a fully fictional secondary world with extensive worldbuilding, often featuring epic stakes and elaborate magic systems.', true, true),
('subgenre','steampunk','Steampunk Romance',
 'Romance combining fantasy or sci-fi with Victorian-era technology — gears, steam, airships, and corsets.', true, true),
('subgenre','demon-romance','Demon Romance',
 'A romance featuring a demon or demonic love interest.', true, true),
('subgenre','vampire-romance','Vampire Romance',
 'A romance with a vampire love interest — bite, bond, eternal devotion.', true, true),
('subgenre','witch-romance','Witch Romance',
 'A romance centered on a witch or magical practitioner.', true, true),
('subgenre','pirate-romance','Pirate Romance',
 'A romance set among pirates, privateers, or seafaring adventurers.', true, true),
('subgenre','mystery','Romantic Mystery',
 'Romance interwoven with a mystery the leads must solve together.', true, true),
('subgenre','suspense','Romantic Suspense',
 'Romance built around tension, danger, and uncertainty driving the plot.', true, true),
('subgenre','dystopian','Dystopian Romance',
 'Romance set in a broken, oppressive, or post-collapse society.', true, true),
('subgenre','horror-romance','Horror Romance',
 'Romance with horror elements designed to unsettle as much as seduce.', true, true),
('subgenre','sports-romance','Sports Romance',
 'Romance set within competitive sports — athletes, coaches, teams, championships.', true, true),
('subgenre','romantic-comedy','Funny / Romantic Comedy',
 'Romance with humor as a primary tone — banter, hijinks, situational comedy.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 2. TIME PERIODS (Tier 2 — new category) ────────────────────────────────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('time-period','ancient','Ancient Times',
 'Settings inspired by ancient civilizations — Egypt, Rome, Greece, Mesopotamia.', true, true),
('time-period','medieval','Medieval',
 'Set during a medieval-inspired era — castles, knights, courts, sword and crown.', true, true),
('time-period','tudor-stuart','Tudor & Stuart',
 'Set during the Tudor or Stuart periods of England (1485–1714).', true, true),
('time-period','georgian','Georgian',
 'Set during the Georgian era (1714–1830) — elegance, scandal, the rise of the rake.', true, true),
('time-period','regency','Regency',
 'Set during the Regency era (1811–1820) — Bridgerton territory. Balls, scandal, marriage of convenience.', true, true),
('time-period','victorian','Victorian',
 'Set during the Victorian era (1837–1901) — moral codes, repression, secret desires.', true, true),
('time-period','western-frontier','Western Frontier',
 'Set during frontier expansion — cowboys, ranches, lawless towns.', true, true),
('time-period','american-civil-war','American Civil War',
 'Set during or around the American Civil War (1861–1865).', true, true),
('time-period','twentieth-century','20th Century',
 'Set during the 1900s — Roaring Twenties, World Wars, mid-century, late 1900s.', true, true),
('time-period','contemporary','Contemporary',
 'Set in the present day — no magic, no time travel, just modern romance.', true, true),
('time-period','futuristic','Futuristic',
 'Set in a future — near-future, sci-fi, post-apocalyptic, or speculative.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 3. SETTINGS (Tier 2) ──────────────────────────────────────────────────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('setting','college','College',
 'A story set in a college or university — exams, parties, professors who shouldn''t.', true, true),
('setting','high-school','High School',
 'Set during high school years — coming-of-age, first loves, hallway politics.', true, true),
('setting','small-town','Small Town',
 'Set in a close-knit small community — everyone knows everyone, nothing stays secret.', true, true),
('setting','space','Space',
 'Primarily set in outer space — vast distances, alien worlds, ship-bound romance.', true, true),
('setting','alien-planet','Alien Planet',
 'Set on a planet inhabited by alien species — foreign culture, biology, customs.', true, true),
('setting','human-colony','Human Colony',
 'Set within a human settlement on another world — frontier dynamics in space.', true, true),
('setting','spaceship','Spaceship',
 'A spacecraft is the primary setting — tight quarters, forced proximity, deep space.', true, true),
('setting','space-station','Space Station',
 'Set aboard a space station — a hub of cultures, politics, secrets.', true, true),
('setting','workplace','Workplace / Office',
 'Set in a professional environment — office romance, coworkers, after-hours.', true, true),
('setting','dragon-academy','Dragon Academy',
 'A school or training environment focused on dragons and their riders.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 4. WORLDBUILDING (Tier 2) ─────────────────────────────────────────────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('worldbuilding','magic-system','Magic System',
 'The structured set of rules governing how magic works in a world — sources, limits, costs.', true, true),
('worldbuilding','elemental-magic','Elemental Magic',
 'Magic powered by control of natural elements — fire, water, earth, air.', true, true),
('worldbuilding','blood-magic','Blood Magic',
 'Magic that requires blood as a source — costly, intimate, often forbidden.', true, true),
('worldbuilding','necromancy','Necromancy',
 'Magic of death, spirits, and resurrection — taboo in most worlds, devastating where allowed.', true, true),
('worldbuilding','magical-academy','Magical Academy',
 'A school dedicated to teaching magic — Fourth Wing, ACOTAR''s Night Court training, Hogwarts-adjacent.', true, true),
('worldbuilding','dragon-riders','Dragon Riders',
 'Humans bonded to dragons — telepathic link, war partner, soul match.', true, true),
('worldbuilding','royal-courts','Royal Courts',
 'Political systems ruled by nobility — succession, alliances, scheming nobles.', true, true),
('worldbuilding','kingdoms-empires','Kingdoms & Empires',
 'Large political powers drive the story — alliances, wars, succession.', true, true),
('worldbuilding','gods-goddesses','Gods & Goddesses',
 'Divine beings directly influence events — favored mortals, divine bargains, prophecy.', true, true),
('worldbuilding','prophecy','Prophecy',
 'Future events are foretold and shape the plot — the chosen one, the inevitable, the loophole.', true, true),
('worldbuilding','cursed-objects','Cursed Objects',
 'Magical items carrying dangerous effects — heirlooms, weapons, jewelry with a price.', true, true),
('worldbuilding','magical-creatures','Magical Creatures',
 'Supernatural beings populate the world — dragons, griffins, fae beasts.', true, true),
('worldbuilding','portals','Portals',
 'Characters travel between worlds or realms via doorways, mirrors, or magical thresholds.', true, true),
('worldbuilding','parallel-worlds','Parallel Worlds',
 'Multiple realities or dimensions exist — what-ifs given form.', true, true),
('worldbuilding','reincarnation','Reincarnation',
 'Characters reborn across lifetimes — lovers finding each other again and again.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 5. TROPES (Tier 2 — new tropes from CSV) ─────────────────────────────
insert into tags (category, slug, label, description, voice_tagline, is_filterable, has_page) values
('trope','best-friends-brother','Best Friend''s Brother',
 'A romance with your best friend''s sibling — forbidden, awkward, irresistible.',
 'Across the dinner table, ruining your life on purpose.', true, true),
('trope','fake-engagement','Fake Engagement',
 'Characters pretend to be engaged for personal, social, or strategic reasons — until pretend gets too real.',
 'A ring, a lie, and the slow realization neither is acting.', true, true),
('trope','reverse-love-triangle','Reverse Love Triangle',
 'Multiple characters pursue the same romantic interest — the protagonist as the prize.',
 'Two people. One you. Pick. (You don''t pick.)', true, true),
('trope','high-lord','High Lord',
 'A powerful ruler overseeing a magical territory, kingdom, or court — used to being obeyed; undone only by her.',
 'Runs a court. Could end you. Chose you instead.', true, true),
('trope','fallen-angel','Fallen Angel',
 'An angelic being cast out from heaven or stripped of divine status — a different kind of grace.',
 'Cast out. Still beautiful. Still dangerous.', true, true),
('trope','arranged-marriage','Arranged Marriage',
 'Characters married off by family, court, or contract — love arrives second.',
 'They didn''t pick. They might end up choosing each other anyway.', true, true),
('trope','caretaking','Caretaking',
 'One character actively looks after another — illness, injury, emotional crisis — and the line between caretaker and lover blurs.',
 'Tending wounds. Catching feelings.', true, true),
('trope','friends-with-benefits','Friends with Benefits',
 'Sex without commitment between people who like each other — until one of them stops being able to keep it casual.',
 'Just sex. Just sex. Just sex. (It''s not just sex.)', true, true),
('trope','good-grovel','Good Grovel',
 'A character who caused harm or betrayal makes a meaningful, satisfying effort to earn forgiveness — not a quick "sorry."',
 'Earned, not asked for.', true, true),
('trope','hurt-comfort','Hurt / Comfort',
 'One character experiences pain — physical or emotional — and another provides care and presence.',
 'When devastation gets a witness.', true, true),
('trope','instalove','Instalove',
 'Characters fall deeply in love almost immediately after meeting.',
 'Saw him. Done.', true, true),
('trope','pregnancy','Pregnancy',
 'A pregnancy plays a central role in the plot or relationship.', null, true, true),
('trope','second-chance','Second Chance',
 'Former romantic partners reconnect and attempt to rebuild their relationship.',
 'They blew it once. This time they know.', true, true),
('trope','secret-baby','Secret Baby',
 'A character discovers they have a child they were previously unaware of.',
 'Surprise: you''re a parent. Also surprise: love.', true, true),
('trope','secret-relationship','Secret Relationship',
 'Characters hide their romantic involvement from others — family, court, public.',
 'Hidden in plain sight. One slip away from chaos.', true, true),
('trope','siblings-best-friend','Sibling''s Best Friend',
 'A romance with your sibling''s close friend — knew them forever, never like this.',
 'They''ve been at every Thanksgiving. Now they''re at YOURS.', true, true),
('trope','age-gap','Age Gap',
 'A significant age difference between the romantic leads — experience meets youth, or vice versa.',
 'Years apart. Same wavelength.', true, true),
('trope','step-siblings','Step-Siblings',
 'A romance between characters who become siblings through marriage — not blood.',
 'Forbidden. Technically. Mostly.', true, true),
('trope','love-triangle','Love Triangle',
 'Romantic conflict involving three people — and only one can win.',
 'Three people. Two endgames. No clean exit.', true, true),
('trope','abduction','Abduction',
 'A character is taken — often by the love interest, sometimes by an antagonist.',
 'Taken. (Captive bonding ensues.)', true, true),
('trope','betrayal','Betrayal',
 'A major breach of trust drives the story — secrets revealed, sides switched, love tested.', null, true, true),
('trope','mafia-romance','Mafia Romance',
 'Romance set in organized crime — loyalty, danger, blood oaths, complicated love.',
 'He''s a problem. She''s already in love with the problem.', true, true),
('trope','military-romance','Military Romance',
 'Romance involving active military service or veterans — duty, deployment, coming home.', null, true, true),
('trope','superheroes','Superhero Romance',
 'Romance featuring characters with superpowers or hidden identities.', null, true, true),
('trope','survival','Survival',
 'Characters must endure dangerous conditions to survive — isolation forges intimacy.', null, true, true),
('trope','found-family','Found Family',
 'Characters form deep family-like bonds outside of blood — chosen, fought for, protected.',
 'The family that picks you back.', true, true),
('trope','cheating','Cheating',
 'Infidelity occurs within a romantic relationship — sometimes the inciting incident, sometimes the wound.', null, true, true)
on conflict (category, slug) do update set
  description   = coalesce(tags.description, excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline),
  has_page      = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 6. CONTENT WARNINGS (Tier 2 — ALL get pages, per safety priority) ─────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('warning','no-hea','No HEA',
 'The story does not conclude with a Happily Ever After. Important to flag — many romance readers consider HEA a genre requirement.', true, true),
('warning','non-traditional-hea','Non-Traditional HEA',
 'The story ends positively but the ending differs from a conventional romantic resolution.', true, true),
('warning','ableism','Ableism',
 'Depictions of discrimination, prejudice, or harmful attitudes toward disabled individuals.', true, true),
('warning','abuse','Abuse',
 'Physical, emotional, psychological, verbal, or sexual abuse depicted within the story.', true, true),
('warning','past-child-neglect','Past Child Neglect',
 'References to neglect experienced during childhood — backstory or memory.', true, true),
('warning','past-child-abuse','Past Child Abuse',
 'References to abuse experienced during childhood — character backstory.', true, true),
('warning','past-abuse','Past Abuse',
 'A character has a history of abuse predating the events of the story.', true, true),
('warning','third-party-abuse','Third-Party Abuse',
 'Abuse committed by a character outside the primary romantic relationship.', true, true),
('warning','abuse-between-mcs','Abuse Between MCs',
 'Abuse occurs between the main romantic characters. A serious flag many readers want to know about going in.', true, true),
('warning','animal-abuse','Animal Abuse',
 'Animals are intentionally harmed, neglected, or mistreated on-page.', true, true),
('warning','animal-death','Animal Death',
 'The death of an animal is depicted or discussed.', true, true),
('warning','birth-control-non-consent','Birth Control Non-Consent',
 'One character interferes with, removes, or deceives another regarding birth control.', true, true),
('warning','body-betrayal','Body Betrayal',
 'A character experiences unwanted physical attraction toward someone they dislike or distrust.', true, true),
('warning','death-grief','Death / Grief',
 'Significant death, mourning, or bereavement is central to the story.', true, true),
('warning','child-death','Child Death',
 'The death of a child is depicted or discussed.', true, true),
('warning','dubious-consent','Dubious Consent',
 'Sexual situations where consent is unclear, impaired, pressured, or ethically questionable.', true, true),
('warning','eating-disorders','Eating Disorders',
 'Depictions of disordered eating behaviors or eating disorder recovery.', true, true),
('warning','fatphobia','Fatphobia',
 'Depictions of anti-fat bias, discrimination, or body shaming.', true, true),
('warning','forced-pregnancy','Forced Pregnancy',
 'Pregnancy occurs through coercion, manipulation, magical compulsion, or lack of consent.', true, true),
('warning','gambling','Gambling',
 'Problematic or significant gambling behavior is present.', true, true),
('warning','graphic-violence','Graphic Violence',
 'Violence depicted in explicit detail — gore, torture, brutal combat.', true, true),
('warning','human-trafficking','Human Trafficking',
 'Characters experience or are involved in forced exploitation or trafficking.', true, true),
('warning','incest','Incest',
 'Sexual or romantic relationships between close family members.', true, true),
('warning','mental-illness','Mental Illness',
 'Characters experience diagnosed or implied mental health conditions — depression, anxiety, psychosis, etc.', true, true),
('warning','mental-trauma','Mental Trauma',
 'Characters experience significant psychological trauma — flashbacks, PTSD, dissociation.', true, true),
('warning','miscarriage','Miscarriage',
 'Pregnancy loss is depicted or discussed.', true, true),
('warning','infertility','Infertility',
 'Difficulty conceiving or carrying a pregnancy plays a role in the story.', true, true),
('warning','misogyny','Misogyny',
 'Sexism, discrimination, or prejudice against women appears in the story.', true, true),
('warning','queerphobia','Queerphobia',
 'Homophobia, transphobia, or discrimination against LGBTQ+ individuals appears in the story.', true, true),
('warning','racism','Racism',
 'Racial prejudice, discrimination, or racial violence appears in the story.', true, true),
('warning','rape','Rape',
 'Sexual assault or rape is depicted or discussed. Always flag — readers deserve advance notice.', true, true),
('warning','non-consent-between-mcs','Non-Consent Between MCs',
 'Sexual activity occurs between main characters without consent.', true, true),
('warning','third-party-sexual-abuse','Third-Party Sexual Abuse',
 'Sexual assault committed by someone outside the primary relationship.', true, true),
('warning','past-sexual-abuse','Past Sexual Abuse',
 'A character has a history of sexual abuse before the story begins.', true, true),
('warning','religious-trauma','Religious Trauma',
 'Psychological harm resulting from religious beliefs, institutions, or experiences.', true, true),
('warning','self-harm','Self-Harm',
 'Intentional self-injury is depicted or discussed.', true, true),
('warning','slut-shaming','Slut-Shaming',
 'Characters are criticized, judged, or humiliated for sexual behavior.', true, true),
('warning','stalking','Stalking',
 'Persistent unwanted surveillance, following, or monitoring of a character.', true, true),
('warning','substance-abuse','Substance Abuse',
 'Problematic use of drugs, alcohol, or other substances.', true, true),
('warning','alcoholism','Alcoholism',
 'Alcohol dependency or addiction is depicted.', true, true),
('warning','drug-abuse','Drug Abuse',
 'Misuse or addiction involving drugs is depicted.', true, true),
('warning','suicide','Suicide / Ideation',
 'Suicide attempts, suicide, or suicidal ideation are depicted or discussed.', true, true),
('warning','terminal-illness','Terminal Illness',
 'A character suffers from a life-limiting or incurable illness.', true, true),
('warning','torture-of-mcs','Torture of MCs',
 'A main character experiences torture.', true, true),
('warning','torture-of-side-characters','Torture of Side Characters',
 'A secondary character experiences torture.', true, true),
('warning','victim-blaming','Victim Blaming',
 'Responsibility for abuse, assault, or harm is placed on the victim rather than the perpetrator.', true, true),
('warning','slavery','Slavery',
 'Slavery exists or plays a major role in the story.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 7. REPRESENTATION — Race / Culture / Religion / LGBTQ+ / etc (Tier 2) ──
insert into tags (category, slug, label, description, is_filterable, has_page) values
('representation','black-mc','Black MC',
 'A story featuring a Black main character — own-voices, representation, identity at the center.', true, true),
('representation','african-american','African-American',
 'A story featuring an African-American main character — culturally specific representation.', true, true),
('representation','bw-wm','BW/WM Romance',
 'A romance between a Black woman and White man — a specific representation niche.', true, true),
('representation','east-asian-mc','East Asian MC',
 'A story featuring an East Asian main character — Chinese, Japanese, Korean, and more.', true, true),
('representation','indigenous-mc','Indigenous MC',
 'A story featuring an Indigenous main character — own-voices representation matters here.', true, true),
('representation','latinx-mc','Latinx MC',
 'A story featuring a Latinx main character.', true, true),
('representation','south-asian-mc','South Asian / Desi MC',
 'A story featuring a South Asian / Desi main character.', true, true),
('representation','southeast-asian-mc','Southeast Asian MC',
 'A story featuring a Southeast Asian main character.', true, true),
('representation','faith','Faith',
 'Religious beliefs play a meaningful role in the story — practice, doubt, devotion.', true, true),
('representation','amish','Amish',
 'Features Amish characters, communities, or culture.', true, true),
('representation','buddhist','Buddhist',
 'Includes Buddhist beliefs, practices, or characters.', true, true),
('representation','christian','Christian Romance',
 'Includes Christian beliefs, practices, or characters. Often a clean-romance subgenre with explicit values.', true, true),
('representation','hindu','Hindu',
 'Includes Hindu beliefs, practices, or characters.', true, true),
('representation','jewish','Jewish Romance',
 'Includes Jewish beliefs, practices, or characters.', true, true),
('representation','muslim','Muslim Romance',
 'Includes Muslim beliefs, practices, or characters.', true, true),
('representation','pagan','Pagan',
 'Includes pagan religions, traditions, or practices.', true, true),
('representation','gay','Gay Romance',
 'A romance between two men — MM romance.', true, true),
('representation','lesbian','Lesbian Romance',
 'A romance between two women — FF / WLW romance.', true, true),
('representation','non-binary','Non-Binary Romance',
 'A romance featuring a non-binary lead.', true, true),
('representation','queer-romance','Queer Romance',
 'Features LGBTQ+ romantic relationships — umbrella term.', true, true),
('representation','queer-awakening','Queer Awakening',
 'A character discovers, names, or explores their queer identity through the story.', true, true),
('representation','bisexual','Bisexual MC',
 'A main character is bisexual — attracted to more than one gender.', true, true),
('representation','disabilities-scars','Disabilities & Scars',
 'Features characters with significant disabilities, visible scars, or disfigurement — desirable, not despite. Representation done right.', true, true),
('representation','neurodivergent','Neurodivergent MC',
 'A main character is neurodivergent — autistic, ADHD, etc. Often own-voices.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 8. KINKS (Tier 2 popular, Tier 3 niche) ───────────────────────────────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('kink','fem-dom','Fem-Dom',
 'A relationship dynamic where the female partner is dominant.', true, true),
('kink','masc-dom','Masc-Dom',
 'A relationship dynamic where the masculine partner is dominant.', true, true),
('kink','role-switching','Role Switching',
 'Partners alternate between dominant and submissive roles.', true, true),
('kink','bondage','Bondage',
 'Restraint dynamics — physical or implied. A BDSM staple.', true, true),
('kink','spanking','Spanking',
 'Impact play involving spanking — punishment, praise, both.', true, true),
('kink','breeding','Breeding',
 'Pregnancy or impregnation themes central to the romantic fantasy — common in shifter, omegaverse, and dark romance.', true, true),
('kink','consensual-non-consent','Consensual Non-Consent (CNC)',
 'A consent dynamic where partners agree in advance to scenes that mimic non-consent. Negotiated, scripted, safe-worded.', true, true),
('kink','daddy-kink','Daddy Kink',
 'A consensual dynamic involving nurturing, authority, or caregiver themes between adult partners.', true, true),
('kink','exhibitionism','Exhibitionism',
 'A character gains excitement from being observed or potentially observed during intimate moments.', true, true),
('kink','menage','Ménage',
 'A romantic relationship involving three people.', true, true),
('kink','poly','Polyamory',
 'A consensual romantic relationship involving more than two people — all parties knowing, all consenting.', true, true),
('kink','harem','Harem',
 'One character develops romantic relationships with multiple partners simultaneously.', true, true),
('kink','primal-chase','Primal / Chase Play',
 'Intimacy incorporating pursuit, hunting, or instinct — predator/prey dynamics.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 9. MECHANICS — Door style refinements (Tier 2) ────────────────────────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('mechanics','glimpses-and-kisses','Glimpses & Kisses',
 'Minimal on-page intimacy — hand-holding, embraces, the occasional kiss. Sweetest end of the spice scale.', true, true),
('mechanics','behind-closed-doors','Behind Closed Doors',
 'Intimate scenes occur off-page — the camera cuts away at the bedroom door.', true, true),
('mechanics','explicit-open-door','Explicit Open Door',
 'Intimate scenes shown on the page with explicit detail.', true, true),
('mechanics','explicit-and-plentiful','Explicit & Plentiful',
 'Frequent, highly explicit intimate scenes. The spiciest tier.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 10. MC ARCHETYPES — Heroine types (Tier 2 popular, Tier 3 niche) ──────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('mc-archetype','alpha-female','Alpha Female',
 'A dominant, confident female lead who commands authority and respect — the room turns when she enters.', true, true),
('mc-archetype','powerful-fmc','Powerful FMC',
 'A female protagonist with significant magical, political, or physical power. Not the prize — the threat.', true, true),
('mc-archetype','dominant-fmc','Dominant FMC',
 'A female main character who takes a leading or controlling role in the relationship.', true, true),
('mc-archetype','sassy-heroine','Sassy Heroine',
 'A witty, outspoken heroine with a sharp tongue and zero filter.', true, true),
('mc-archetype','take-charge-heroine','Take-Charge Heroine',
 'A heroine who naturally assumes leadership — in love, in war, at the breakfast table.', true, true),
('mc-archetype','independent-heroine','Independent Heroine',
 'A protagonist who values self-reliance and autonomy. Doesn''t need saving — but might let him try.', true, true),
('mc-archetype','grumpy-heroine','Grumpy / Ice Queen',
 'A reserved or emotionally guarded heroine. Walls up. Softens only for him.', true, true),
('mc-archetype','sweet-heroine','Sweet / Gentle Heroine',
 'A kind, compassionate protagonist — pure heart, surprising spine.', true, true),
('mc-archetype','cheerful-heroine','Cheerful / Sunshine Heroine',
 'An optimistic, upbeat female protagonist. Sunshine to his grump.', true, true),
('mc-archetype','competent-heroine','Competent Heroine',
 'A highly capable protagonist who excels at what she does. Quiet expertise.', true, true),
('mc-archetype','female-rake','Female Rake',
 'A confident heroine known for charm, flirtation, or sexual experience — owning her appetite.', true, true),
('mc-archetype','tortured-heroine','Tortured Heroine',
 'A heroine carrying significant trauma or emotional pain. Healing is part of the romance.', true, true),
('mc-archetype','single-mother','Single Mother',
 'A heroine raising children on her own — added stakes, real life, full heart.', true, true),
('mc-archetype','virgin-heroine','Virgin Heroine',
 'A heroine with little or no prior sexual experience. Often paired with a more experienced LI.', true, true),
('mc-archetype','dangerous-heroine','Dangerous Heroine',
 'A heroine capable of significant violence or destruction. The threat is part of the appeal.', true, true),
('mc-archetype','gifted-heroine','Gifted / Super-Heroine',
 'A heroine with extraordinary abilities or talents — magic, intelligence, combat.', true, true),
('mc-archetype','immortal-heroine','Immortal Heroine',
 'A heroine with an exceptionally long lifespan — vampire, fae, goddess, ancient being.', true, true),
('mc-archetype','non-human-heroine','Non-Human Heroine',
 'A heroine who is not fully human — fae, shifter, demon, alien, more.', true, true),
('mc-archetype','asexual-heroine','Asexual Heroine',
 'A heroine who experiences little or no sexual attraction. Romance built differently.', true, true),
('mc-archetype','demisexual-heroine','Demisexual Heroine',
 'A heroine who experiences attraction primarily after emotional connection.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- Niche heroine variants — Tier 3 (filterable tags only, no page)
insert into tags (category, slug, label, is_filterable, has_page, glossary_visible) values
('mc-archetype','poor-heroine','Poor Heroine',                       true, false, true),
('mc-archetype','rich-heroine','Rich Heroine',                       true, false, true),
('mc-archetype','stalker-heroine','Stalker Heroine',                 true, false, true),
('mc-archetype','curvy-heroine','Curvy Heroine',                     true, false, true),
('mc-archetype','plain-heroine','Plain Heroine',                     true, false, true),
('mc-archetype','tall-heroine','Tall Heroine',                       true, false, true),
('mc-archetype','teenage-fmc','Teenage FMC',                         true, false, true),
('mc-archetype','early-20s-fmc','Early 20s FMC',                     true, false, true),
('mc-archetype','30s-fmc','30s FMC',                                 true, false, true),
('mc-archetype','40s-plus-fmc','40+ FMC',                            true, false, true),
('mc-archetype','royal-heroine','Aristo / Royal Heroine',            true, false, true),
('mc-archetype','athlete-heroine','Athlete Heroine',                 true, false, true),
('mc-archetype','bodyguard-heroine','Bodyguard / Protector Heroine', true, false, true),
('mc-archetype','famous-heroine','Famous Heroine',                   true, false, true),
('mc-archetype','criminal-heroine','Criminal Heroine',               true, false, true),
('mc-archetype','sleuth-heroine','Sleuth Heroine',                   true, false, true),
('mc-archetype','teacher-heroine','Teacher / Coach Heroine',         true, false, true),
('mc-archetype','warrior-heroine','Warrior Heroine',                 true, false, true),
('mc-archetype','white-collar-heroine','White-Collar Heroine',       true, false, true),
('mc-archetype','working-class-heroine','Working-Class Heroine',     true, false, true)
on conflict (category, slug) do nothing;

-- ── 11. LI ARCHETYPES — Hero types (Tier 2 popular, Tier 3 niche) ─────────
insert into tags (category, slug, label, description, voice_tagline, is_filterable, has_page) values
('li-archetype','alpha-male','Alpha Male',
 'A confident, dominant, assertive male love interest — the leader, the protector, the one who decides.',
 'Decides. Provides. Devastates.', true, true),
('li-archetype','bad-boy','Bad Boy',
 'A rebellious or rule-breaking hero — tattoos optional, redemption arc mandatory.',
 'He''s a problem. You''re falling anyway.', true, true),
('li-archetype','cruel-hero','Cruel / Bully Hero',
 'A hero who initially mistreats or antagonizes the protagonist — the path from cruelty to devotion.',
 'He''s the worst. The worst is the point.', true, true),
('li-archetype','grumpy-hero','Grumpy / Cold Hero',
 'An emotionally reserved, distant hero. Softens only for her.',
 'Cold to everyone. Devastated by her specifically.', true, true),
('li-archetype','himbo','Himbo',
 'A kind-hearted but not particularly intellectual hero. Sweet, devoted, frequently shirtless.',
 'Heart of gold. Brain... still working on it.', true, true),
('li-archetype','nerdy-hero','Nerdy Hero',
 'A hero known for intelligence, academics, or niche obsessions. The quiet kind.',
 'Smart. Sweet. Genuinely doesn''t know how hot he is.', true, true),
('li-archetype','possessive-hero','Possessive Hero',
 'A hero who is intensely protective and territorial. "Mine" is a position, not a guess.',
 'His. Hers. Settled.', true, true),
('li-archetype','shy-hero','Shy Hero',
 'A reserved, awkward, or introverted hero. Pining loud on the inside.',
 'Quiet on the outside. Loud inside.', true, true),
('li-archetype','sunny-hero','Sunny / Happy Hero',
 'An optimistic, upbeat hero. The bright one in a brooding genre.',
 'Sunshine. Pure, dangerous sunshine.', true, true),
('li-archetype','sweet-hero','Sweet / Gentle Hero',
 'A compassionate, caring hero. Soft on her specifically.', null, true, true),
('li-archetype','dominant-mmc','Dominant MMC',
 'A male main character who takes a leading or controlling role in the relationship — bedroom, partnership, life.',
 'Decides. Protects. Provides. You don''t have to.', true, true),
('li-archetype','morally-grey-mmc','Morally Grey MMC',
 'A male main character whose actions blur the line between right and wrong — willing to break rules, ethics, kingdoms for her.',
 'Wrong by most metrics. Right by hers.', true, true),
('li-archetype','emotional-support-shadow-daddy','Emotional Support Shadow Daddy',
 'A dark, intimidating hero who is surprisingly caring, emotionally available, and devoted. The shadow daddy who also remembers her favorite tea.',
 'Made of darkness. Brings her water in the night.', true, true),
('li-archetype','immortal-hero','Immortal Hero',
 'A romantic lead who has lived for centuries or longer. Waited for her. Specifically.',
 'Centuries old. Patient. Has thoughts.', true, true),
('li-archetype','age-old-hero','Age-Old Hero',
 'A supernatural character significantly older than their human partner.', null, true, true),
('li-archetype','ceo','CEO / Tycoon',
 'A business leader or corporate executive — power, money, devastating in a suit.',
 'Owns the company. About to own the rest of you.', true, true),
('li-archetype','cowboy','Cowboy',
 'A rancher, horseman, or western hero. Quiet competence, calloused hands.',
 'Quiet hands. Slow drawl. End of you.', true, true),
('li-archetype','biker','Biker',
 'A hero involved in motorcycle culture — leather, brotherhood, loyalty over law.', null, true, true),
('li-archetype','men-in-uniform','Men in Uniform',
 'A hero serving in military, police, fire, or similar professions. Discipline, duty, off-duty trouble.', null, true, true),
('li-archetype','rockstar','Rockstar',
 'A musician or performer — fame, chaos, the song he wrote about her.', null, true, true),
('li-archetype','royal-hero','Royal Hero',
 'A king, prince, duke, or noble hero. Crown, duty, one extremely inconvenient feeling.', null, true, true),
('li-archetype','viking-hero','Viking Hero',
 'A Norse-inspired warrior or explorer hero — raids, oaths, devotion that lasts a saga.', null, true, true),
('li-archetype','highlander-hero','Highlander Hero',
 'A hero from the Scottish Highlands or inspired setting — kilts, clans, oaths, brogue.', null, true, true),
('li-archetype','single-father','Single Father',
 'A hero raising children on his own. Stakes raised, heart larger.', null, true, true),
('li-archetype','warlord','Warlord / Commander',
 'A military leader or battlefield commander — strategy, scars, the moment he chooses softness.', null, true, true)
on conflict (category, slug) do update set
  description   = coalesce(tags.description, excluded.description),
  voice_tagline = coalesce(tags.voice_tagline, excluded.voice_tagline),
  has_page      = case when tags.description is null then excluded.has_page else tags.has_page end;

-- Niche hero variants — Tier 3 (filterable tags only, no page)
insert into tags (category, slug, label, is_filterable, has_page, glossary_visible) values
('li-archetype','rich-hero','Rich Hero',                       true, false, true),
('li-archetype','non-human-hero','Non-Human Hero',             true, false, true),
('li-archetype','stalker-hero','Stalker Hero',                 true, false, true),
('li-archetype','virgin-hero-li','Virgin Hero',                true, false, true),
('li-archetype','actor-hero','Actor Hero',                     true, false, true),
('li-archetype','athlete-hero','Athlete Hero',                 true, false, true),
('li-archetype','bodyguard-hero','Bodyguard / Protector Hero', true, false, true),
('li-archetype','fighter','Fighter / MMA Hero',                true, false, true),
('li-archetype','pirate-hero','Pirate Hero',                   true, false, true),
('li-archetype','politician-hero','Politician Hero',           true, false, true),
('li-archetype','teacher-hero','Teacher / Coach Hero',         true, false, true),
('li-archetype','working-class-hero','Working-Class Hero',     true, false, true),
('li-archetype','sheik','Sheik',                               true, false, true)
on conflict (category, slug) do nothing;

-- ── 12. FORMAT — Page count buckets (Tier 3) ──────────────────────────────
insert into tags (category, slug, label, is_filterable, has_page, glossary_visible) values
('format','novella','Novella (1-149 pages)',            true, false, true),
('format','short','Short (150-249 pages)',              true, false, true),
('format','medium','Medium (250-399 pages)',            true, false, true),
('format','long','Long (400-599 pages)',                true, false, true),
('format','epic','Epic (600+ pages)',                   true, false, true),
('format','first-in-series','First in Series',          true, false, true),
('format','standalone-or-first','Standalone or First in Series', true, false, true)
on conflict (category, slug) do nothing;

-- ── 13. SPORT (new category, Tier 2 popular + Tier 3 niche) ───────────────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('sport','football','Football',
 'A football romance — players, coaches, locker rooms, the field.', true, true),
('sport','hockey','Hockey',
 'A hockey romance — rink, road games, the way they take care of each other.', true, true),
('sport','basketball','Basketball',
 'A basketball romance — courts, championships, after-game heat.', true, true),
('sport','baseball','Baseball',
 'A baseball romance — diamonds, seasons, slow burns paced like the game.', true, true),
('sport','mma','Fighting / MMA / Boxing',
 'A fighting-sports romance — rings, cages, controlled violence and uncontrollable feelings.', true, true),
('sport','soccer','Soccer / Football',
 'A soccer / football romance — pitches, World Cups, devotion as a team sport.', true, true),
('sport','skating','Ice / Figure Skating',
 'A skating romance — ice, partner work, lifts that mean something.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 14. RELATIONSHIP / OPPOSITES (Tier 2) ─────────────────────────────────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('trope','boss-employee','Boss & Employee',
 'A romance between a superior and subordinate — workplace ethics, complicated power, very motivated readers.',
 true, true),
('trope','multicultural','Multicultural Romance',
 'A romance involving characters from different cultural backgrounds — bridging, blending, sometimes clashing.',
 true, true),
('trope','best-friends-parent','Best Friend''s Parent',
 'Romance with a best friend''s parent. Forbidden, complicated, the kind of trope readers know exactly why they''re here for.',
 true, true),
('trope','parents-best-friend','Parent''s Best Friend',
 'Romance with a parent''s close friend — they''ve known you since you were small. Now they''re seeing you differently.',
 true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- Niche relationship tags — Tier 3
insert into tags (category, slug, label, is_filterable, has_page, glossary_visible) values
('trope','class-difference','Class Difference',     true, false, true),
('trope','height-difference','Height Difference',   true, false, true)
on conflict (category, slug) do nothing;

-- ── 15. CULTURE — endings (Tier 2/3) ──────────────────────────────────────
insert into tags (category, slug, label, description, is_filterable, has_page) values
('culture','no-3rd-act-breakup','No Third-Act Break-up',
 'The main couple does not separate before the ending. Reader request for tropes that DON''T appear — increasingly common ask.', true, true),
('culture','hopeful-ending','Hopeful Ending',
 'An ending that leaves characters in a positive or optimistic position — not strictly HEA, but readers can breathe.', true, true),
('culture','cliffhanger','Cliffhanger',
 'The story ends with major unresolved events. Use to set expectations — many readers want to know before they start.', true, true),
('culture','christmas','Christmas / Holiday',
 'Set during or centered around Christmas — seasonal romance, cocoa, snowed-in adjacency.', true, true)
on conflict (category, slug) do update set
  description = coalesce(tags.description, excluded.description),
  has_page    = case when tags.description is null then excluded.has_page else tags.has_page end;

-- ── 16. Niche kink variants — Tier 3 ──────────────────────────────────────
insert into tags (category, slug, label, is_filterable, has_page, glossary_visible) values
('kink','age-play','Age Play',                                  true, false, true),
('kink','anal-sex','Anal Sex',                                  true, false, true),
('kink','creative-anatomy','Creative Anatomy',                  true, false, true),
('kink','double-penetration','Double Penetration',              true, false, true),
('kink','double-anal','Double Anal',                            true, false, true),
('kink','double-vaginal','Double Vaginal',                      true, false, true),
('kink','fetish','Fetish',                                      true, false, true),
('kink','pegging','Pegging',                                    true, false, true),
('kink','somnophilia','Somnophilia',                            true, false, true),
('kink','older-mature','Older / Mature',                        true, false, true),
('kink','childfree','Childfree',                                true, false, true)
on conflict (category, slug) do nothing;

-- ── 17. War as trope (Tier 3 — too generic for own page) ──────────────────
insert into tags (category, slug, label, is_filterable, has_page, glossary_visible) values
('trope','war','War',                              true, false, true),
('trope','vengeance','Vengeance',                  true, false, true)
on conflict (category, slug) do nothing;

-- ── report ─────────────────────────────────────────────────────────────────
do $$
declare n_total int; n_pages int; n_filters int;
begin
  select count(*) into n_total   from tags where glossary_visible;
  select count(*) into n_pages   from tags where glossary_visible and has_page and description is not null;
  select count(*) into n_filters from tags where glossary_visible and (not has_page or description is null);
  raise notice 'glossary seed 3 complete → % visible tags, % with pages (Tier 1+2), % filter-only (Tier 3)',
    n_total, n_pages, n_filters;
end $$;
