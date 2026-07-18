-- ════════════════════════════════════════════════════════════════════════
--  smutHub · canonical romantasy seed (batch 1)
--
--  20 flagship romantasy titles most readers search for — mostly series
--  completions for books already in the catalog (ACOTAR 3-4, Throne of Glass
--  2-5.5, Crescent City 2-3, From Blood and Ash 3-4) plus top missing series
--  (Serpent & Dove, Kingdom of the Wicked, Caraval / Once Upon a Broken Heart).
--
--  Every row is fully populated: real blurb, spice, door, series, subgenre,
--  ending, POV, world, and a starter set of trope/mood/vibe tag_ids so the
--  books show up in filters and "more like this" immediately. Covers are left
--  null — fill them from catalog-admin (R2 rehost) or the cover button.
--
--  Slugs follow make_slug(title, surname, year). INSERT ... ON CONFLICT (slug)
--  DO NOTHING — safe to re-run, never overwrites anything you already have.
--
--  Status is 'live', so a rebuild (node scripts/build-books.mjs) publishes
--  pages for all of them. Spot-check spice/blurb in catalog-admin and archive
--  any you don't want.
--
--  Run in Supabase → SQL Editor.  Then: node scripts/build-books.mjs && push.
-- ════════════════════════════════════════════════════════════════════════

insert into books
  (slug, title, author, year, series, series_number, blurb,
   spice_level, spice_frequency, door, subgenre, age_category, ending, cliffhanger,
   standalone, pov, world_type, relationship_type, status, tag_ids)
values
-- ── A Court of Thorns and Roses (Sarah J. Maas) ────────────────────────────
('a-court-of-wings-and-ruin-maas-2017', 'A Court of Wings and Ruin', 'Sarah J. Maas', 2017,
 'A Court of Thorns and Roses', 3,
 'Feyre returns to the Spring Court as a spy, playing the broken bride while she gathers secrets and quietly tears Tamlin''s court apart from within. As war with the merciless King of Hybern becomes inevitable, she must unite the fractured High Lords of Prythian — and reckon with old enemies — to protect her people and the mate she loves.',
 3, 'occasional', 'open', 'romantasy', 'Adult', 'HEA', false,
 false, '1st single', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:fae','trope:fated-mates','trope:enemies-to-lovers','theme:war','vibe:morally-grey','mood:angsty']),

('a-court-of-silver-flames-maas-2021', 'A Court of Silver Flames', 'Sarah J. Maas', 2021,
 'A Court of Thorns and Roses', 4,
 'Nesta Archeron has become a stranger to herself — sharp-edged, self-destructive, and haunted by the war. Forced together with the warrior Cassian to train in the brutal Illyrian mountains, she confronts her trauma, her terrifying new power, and a slow-burning desire that could either destroy her or finally set her free. The spiciest, most emotionally raw entry in the series.',
 5, 'frequent', 'open', 'romantasy', 'Adult', 'HEA', false,
 false, '3rd dual', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:enemies-to-lovers','trope:fated-mates','trope:touch-her-and-die','trope:found-family','vibe:morally-grey','mood:angsty']),

-- ── Throne of Glass (Sarah J. Maas) ────────────────────────────────────────
('crown-of-midnight-maas-2013', 'Crown of Midnight', 'Sarah J. Maas', 2013,
 'Throne of Glass', 2,
 'Celaena Sardothien serves as the king''s champion — an assassin in the service of a tyrant she loathes — while secretly protecting the people she''s ordered to kill. As a friend''s betrayal and a buried magic surface, a devastating loss shatters her, and the truth of who she really is begins to claw its way toward the light.',
 2, 'rare', 'fade', 'romantasy', 'YA', 'cliffhanger', true,
 false, '3rd dual', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:assassin','theme:court-intrigue','trope:slow-burn','vibe:morally-grey','mood:angsty']),

('heir-of-fire-maas-2014', 'Heir of Fire', 'Sarah J. Maas', 2014,
 'Throne of Glass', 3,
 'Broken and grieving, Celaena is sent across the sea to Wendlyn, where she must master a wildfire magic she has spent years burying — under the merciless eye of the immortal Rowan Whitethorn. As a demon queen raises an army in the shadows, Celaena must decide whether to run from her destiny or rise to become the queen her kingdom needs.',
 2, 'rare', 'fade', 'romantasy', 'YA', 'HFN', false,
 false, 'multi', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:enemies-to-lovers','trope:slow-burn','trope:found-family','theme:chosen-one','mood:angsty']),

('queen-of-shadows-maas-2015', 'Queen of Shadows', 'Sarah J. Maas', 2015,
 'Throne of Glass', 4,
 'Aelin Galathynius has returned to Rifthold with fire in her hands and vengeance in her heart. To free her people and reclaim her throne she must confront the king who destroyed her, save the friends still trapped in his web, and become the queen she was born to be — no matter what it costs her.',
 3, 'occasional', 'open', 'romantasy', 'YA', 'HFN', false,
 false, 'multi', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:enemies-to-lovers','theme:court-intrigue','trope:found-family','vibe:morally-grey','mood:adventurous']),

('empire-of-storms-maas-2016', 'Empire of Storms', 'Sarah J. Maas', 2016,
 'Throne of Glass', 5,
 'War is here. Aelin gambles everything to raise the armies she needs, forge the alliances that could save her world, and unlock the ancient power that might be the only thing standing between the living and an unstoppable darkness — while a slow-burning bond with Rowan finally ignites. Ends on a gut-punch you will not see coming.',
 4, 'occasional', 'open', 'romantasy', 'YA', 'cliffhanger', true,
 false, 'multi', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:fated-mates','theme:war','trope:found-family','trope:slow-burn','mood:angsty','vibe:high-stakes']),

('tower-of-dawn-maas-2017', 'Tower of Dawn', 'Sarah J. Maas', 2017,
 'Throne of Glass', 6,
 'Crippled by his wounds, Chaol Westfall travels to the healing khaganate of Antica to mend his body and beg an empire for aid in the coming war. What he finds instead is a fierce young healer, a nest of ancient evil, and a path to redemption he never believed he deserved. Runs parallel to Empire of Storms.',
 3, 'occasional', 'open', 'romantasy', 'YA', 'HEA', false,
 false, 'multi', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:slow-burn','trope:hurt-comfort','theme:war','mood:emotional']),

-- ── The Empyrean (Rebecca Yarros) ──────────────────────────────────────────
('onyx-storm-yarros-2025', 'Onyx Storm', 'Rebecca Yarros', 2025,
 'The Empyrean', 3,
 'Violet Sorrengail survived Basgiath, but the war has only begun. To save Navarre — and Xaden — she must venture beyond the wards into uncharted lands in search of allies the kingdom desperately needs, hunting the answers that could turn the tide before the venin overrun everything she loves. The blockbuster third Empyrean book.',
 4, 'frequent', 'open', 'romantasy', 'Adult', 'cliffhanger', true,
 false, '1st single', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:fated-mates','trope:enemies-to-lovers','worldbuilding:dragons','theme:war','vibe:high-stakes','mood:angsty']),

-- ── Crescent City (Sarah J. Maas) ──────────────────────────────────────────
('house-of-sky-and-breath-maas-2022', 'House of Sky and Breath', 'Sarah J. Maas', 2022,
 'Crescent City', 2,
 'Bryce Quinlan and Hunt Athalar are trying to get back to normal after saving Crescent City — but nothing is normal when rebels are whispering of freedom and the brutal Asteri are always watching. As Bryce is drawn into a dangerous underground movement, one reckless choice will crack the world wide open. Ends on a reality-shattering twist.',
 4, 'frequent', 'open', 'romantasy', 'Adult', 'cliffhanger', true,
 false, 'multi', 'urban-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:fated-mates','trope:slow-burn','worldbuilding:fae','theme:war','vibe:high-stakes','mood:angsty']),

('house-of-flame-and-shadow-maas-2024', 'House of Flame and Shadow', 'Sarah J. Maas', 2024,
 'Crescent City', 3,
 'Stranded in a strange, deadly world, Bryce must find her way home while Hunt and their friends face the wrath of the Asteri back in Midgard. As two of Maas''s universes collide, alliances are forged across worlds and everything the Crescent City crew loves hangs by a thread. The explosive Crescent City finale.',
 4, 'frequent', 'open', 'romantasy', 'Adult', 'HEA', false,
 false, 'multi', 'urban-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:fated-mates','worldbuilding:fae','theme:war','trope:found-family','vibe:high-stakes','mood:adventurous']),

-- ── Blood and Ash (Jennifer L. Armentrout) ─────────────────────────────────
('the-crown-of-gilded-bones-armentrout-2021', 'The Crown of Gilded Bones', 'Jennifer L. Armentrout', 2021,
 'Blood and Ash', 3,
 'Poppy has ascended, but the crown she claims comes with a war she never wanted. As the truth of her bloodline and the horrifying secrets of the Ascended unravel, Poppy and Casteel must fight for their people, their bond, and a future the kingdoms of Solis and Atlantia would burn to prevent.',
 4, 'frequent', 'open', 'romantasy', 'Adult', 'cliffhanger', true,
 false, '1st single', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:fated-mates','trope:enemies-to-lovers','worldbuilding:vampires','theme:court-intrigue','vibe:morally-grey','mood:angsty']),

('the-war-of-two-queens-armentrout-2022', 'The War of Two Queens', 'Jennifer L. Armentrout', 2022,
 'Blood and Ash', 4,
 'War has come to Atlantia. With Casteel captured by the Blood Queen, Poppy will raze kingdoms to get him back — unleashing a primal power that could either save her people or doom them all. The stakes, the spice, and the body count all climb in the fourth Blood and Ash book.',
 5, 'frequent', 'open', 'romantasy', 'Adult', 'HFN', false,
 false, 'multi', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:fated-mates','worldbuilding:vampires','theme:war','trope:touch-her-and-die','vibe:high-stakes','mood:angsty']),

-- ── Serpent & Dove (Shelby Mahurin) ────────────────────────────────────────
('serpent-dove-mahurin-2019', 'Serpent & Dove', 'Shelby Mahurin', 2019,
 'Serpent & Dove', 1,
 'Louise le Blanc fled her coven and its bloody magic to hide among the witch-hunters of Cesarine — until a wild twist of fate binds her in marriage to Reid Diggory, the most zealous hunter of them all. Forced to share a life with the man sworn to burn her kind, Lou and Reid discover that the line between enemy and everything is thinner than either dared believe.',
 3, 'occasional', 'open', 'romantasy', 'YA', 'HFN', false,
 false, '1st dual', 'historical', 'MF', 'live',
 array['subgenre:romantasy','trope:enemies-to-lovers','trope:marriage-of-convenience','trope:forced-proximity','worldbuilding:witches','trope:forbidden-love','mood:swoony']),

('blood-honey-mahurin-2020', 'Blood & Honey', 'Shelby Mahurin', 2020,
 'Serpent & Dove', 2,
 'On the run from the Church, their coven, and a vengeful witch queen, Lou, Reid, and their ragtag companions cross a kingdom that wants them all dead. As Lou''s magic grows darker and more seductive, Reid must decide how much of himself he''s willing to lose — and how much of her he''s willing to save.',
 3, 'occasional', 'open', 'romantasy', 'YA', 'cliffhanger', true,
 false, '1st dual', 'historical', 'MF', 'live',
 array['subgenre:romantasy','trope:forced-proximity','worldbuilding:witches','trope:found-family','vibe:morally-grey','mood:angsty']),

('gods-monsters-mahurin-2021', 'Gods & Monsters', 'Shelby Mahurin', 2021,
 'Serpent & Dove', 3,
 'To defeat the witch queen Morgane and save the people she loves, Lou must risk becoming the very monster she''s fought against. In the trilogy''s finale, old gods stir, sacrifices are demanded, and Lou and Reid''s love is tested against the full, terrible weight of destiny.',
 3, 'occasional', 'open', 'romantasy', 'YA', 'HEA', false,
 false, 'multi', 'historical', 'MF', 'live',
 array['subgenre:romantasy','worldbuilding:witches','trope:found-family','theme:chosen-one','vibe:morally-grey','mood:adventurous']),

-- ── Kingdom of the Wicked (Kerri Maniscalco) ───────────────────────────────
('kingdom-of-the-wicked-maniscalco-2020', 'Kingdom of the Wicked', 'Kerri Maniscalco', 2020,
 'Kingdom of the Wicked', 1,
 'Emilia and her twin are witches in nineteenth-century Sicily — until Vittoria is found brutally murdered. Hunting her sister''s killer, Emilia strikes a dangerous bargain with Wrath, one of the seven wicked Princes of Hell, and is pulled into a deadly game of demons, dark magic, and a forbidden attraction that could cost her soul.',
 3, 'occasional', 'open', 'romantasy', 'YA', 'cliffhanger', true,
 false, '1st single', 'paranormal', 'MF', 'live',
 array['subgenre:romantasy','trope:enemies-to-lovers','trope:forbidden-love','worldbuilding:witches','trope:slow-burn','vibe:morally-grey','mood:dark']),

('kingdom-of-the-cursed-maniscalco-2021', 'Kingdom of the Cursed', 'Kerri Maniscalco', 2021,
 'Kingdom of the Wicked', 2,
 'Emilia travels to the underworld and into the seductive court of the Prince of Wrath himself, bound to a demon she can''t trust and can''t resist. Amid decadent feasts, deadly politics, and simmering desire, she must uncover the truth of her sister''s death and her own terrifying power.',
 4, 'frequent', 'open', 'romantasy', 'Adult', 'cliffhanger', true,
 false, '1st single', 'paranormal', 'MF', 'live',
 array['subgenre:romantasy','trope:enemies-to-lovers','trope:forced-proximity','worldbuilding:witches','theme:court-intrigue','vibe:morally-grey','mood:swoony']),

('kingdom-of-the-feared-maniscalco-2022', 'Kingdom of the Feared', 'Kerri Maniscalco', 2022,
 'Kingdom of the Wicked', 3,
 'Newly bound to Wrath, Emilia is caught between the witches who need her and the gods who fear her as an ancient prophecy threatens to tear both realms apart. In the trilogy''s finale, secrets detonate, loyalties break, and Emilia must decide how much of the wicked she''s willing to embrace.',
 4, 'frequent', 'open', 'romantasy', 'Adult', 'HEA', false,
 false, '1st single', 'paranormal', 'MF', 'live',
 array['subgenre:romantasy','trope:fated-mates','worldbuilding:witches','theme:court-intrigue','vibe:morally-grey','mood:swoony']),

-- ── Caraval / Once Upon a Broken Heart (Stephanie Garber) ──────────────────
('caraval-garber-2017', 'Caraval', 'Stephanie Garber', 2017,
 'Caraval', 1,
 'Scarlett Dragna has never left the tiny island where she and her sister live under their father''s cruel thumb — until they''re swept into Caraval, the legendary once-a-year performance where the audience becomes part of the show. When Scarlett''s sister vanishes into the game, Scarlett has five nights to find her before the magic, and the master of ceremonies, consume her whole.',
 1, 'none', 'closed', 'romantasy', 'YA', 'HFN', false,
 false, '3rd single', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:slow-burn','mood:whimsical','vibe:high-stakes','theme:found-family','mood:adventurous']),

('once-upon-a-broken-heart-garber-2021', 'Once Upon a Broken Heart', 'Stephanie Garber', 2021,
 'Once Upon a Broken Heart', 1,
 'Evangeline Fox believes in true love — so when the boy she adores is about to marry another, she strikes a bargain with the immortal, dangerously charming Prince of Hearts. His help comes at a price, and every kiss and curse pulls Evangeline deeper into a world of fate, mischief, and a magic that always demands more than it gives.',
 1, 'none', 'closed', 'romantasy', 'YA', 'HFN', false,
 false, '3rd single', 'high-fantasy', 'MF', 'live',
 array['subgenre:romantasy','trope:enemies-to-lovers','trope:slow-burn','mood:whimsical','trope:forbidden-love','mood:swoony'])

on conflict (slug) do nothing;

do $$
declare n int;
begin
  select count(*) into n from books where status='live';
  raise notice 'canonical seed applied → % live books total', n;
end $$;
