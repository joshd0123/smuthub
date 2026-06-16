-- ════════════════════════════════════════════════════════════════════════
--  smutHub · controlled-vocabulary tag seed  (standalone, additive, re-runnable)
--
--  The same seed is already embedded in 2026-06-16-catalog-normalized.sql, so
--  you only need this file later — to ADD new tags to the vocabulary or to
--  re-seed a fresh database. "on conflict (category, slug) do nothing" means
--  re-running never duplicates and never overwrites a label you've edited.
--
--  Categories: trope · mood · vibe · theme · warning · representation ·
--              setting · kink · mc-archetype · li-archetype
--  Keep slugs lowercase-hyphenated so they match the front-end filters.
--
--  Run in Supabase → SQL Editor (after 2026-06-16-catalog-normalized.sql,
--  which creates the tags table). NOT auto-run.
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
