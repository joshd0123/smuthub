# How We Monetize smutHub

## The product thesis

smutHub should make money from identity, atmosphere, and delight—not from making the basic reading experience worse.

The free product must remain useful on its own: readers can build a bookcase, organize TBR/currently-reading/read/DNF shelves, open book details, rate spice, and enter the included Moonlit Reading Room. Purchases make that personal library feel unmistakably theirs.

The bookcase is the storefront. The immersive shelf worlds are the aspiration.

## The monetization ladder

| Tier | What it sells | Target price | Purpose |
| --- | --- | ---: | --- |
| Tiny personalization | Plaques, shelf labels, trim accents | $0.99–$1.99 | First purchase; almost no deliberation |
| Atmosphere | Weather, lighting, particles, ambient sound | $2.99–$3.99 | Noticeable transformation at a low price |
| Cabinet styles | Wood finishes, lacquer, hardware, full trim sets | $2.99–$4.99 | Personal identity visible every visit |
| Interactive add-ons | Fairies, clocks, familiars, hidden interactions | $2.99–$4.99 | Repeat visits and collectible behavior |
| Shelf worlds | Complete immersive rooms | $6.99–$8.99 | Hero purchase and major visual change |
| Bundles | A world plus matching interactions and cabinet details | $9.99–$12.99 | Best value and higher average order |

All launch prices are hypotheses. We should test purchase rate and attachment rate before optimizing for maximum revenue per item.

## The first sellable catalog

### Included for every reader

- Heirloom Walnut cabinet
- Midnight Lacquer cabinet
- Moonlit Reading Room
- Reading candle
- Ambient clock
- Core shelf organization and book-opening experience

### Small personalization purchases

- Personalized Ex Libris plaque — $0.99
- Gilded Vine Trim — $1.99
- Rosewood Velvet finish — $2.99
- Enchanted Ash finish — $2.99
- Rainy Ambience — $2.99
- Rainbound Oak finish — $3.99

### Immersive purchases

- Fairy Visitors — $2.99
- The Witching Hour interaction pack — $2.99
- Candlelit Boudoir world — $7.99
- Founder’s Sanctuary bundle — $9.99

## Release cadence

The store should feel alive without demanding a giant content release every time.

### Weekly or biweekly

- One plaque, trim, shelf label, lighting preset, or tiny interaction
- Price target: $0.99–$2.99
- Reuse an existing world where possible
- Show a short preview before purchase

### Monthly

- One meaningful interaction pack or cabinet collection
- Price target: $2.99–$4.99
- Pair it with one or two lower-priced matching items

### Every six to eight weeks

- One complete shelf world
- Price target: $6.99–$8.99
- Launch with a $9.99–$12.99 bundle

### Seasonal moments

- Limited-time ambience or world collections for autumn, winter, Valentine’s Day, and major romantasy release periods
- Clearly state whether an item is time-limited or simply seasonally featured
- Never use fake scarcity

## Upcoming release path

1. Candlelit Boudoir — launch world
2. Rainbound Archive — dark-academia world with rain and hidden margin notes
3. Dragon’s Hoard — treasure-room world with a small dragon guarding five-star reads
4. Familiar Companions — raven, fox, and shadow-cat interactions
5. Haunted Manor — seasonal gothic world with portraits and a midnight visitor

Each world should ship with at least one inexpensive item so a reader can participate without buying the full room.

## Where selling belongs in the experience

### The outer bookcase

Sell cabinet finishes, plaques, hardware, trim, and whole-library ambience. These purchases should change the reading sanctuary without changing the shelf world.

### Inside a shelf world

Sell worlds, lighting, props, visitors, soundscapes, and interactions. The user should be able to preview the effect in place before checkout.

### After meaningful moments

Offer relevant items after a reader finishes a book, builds a large TBR, rates a five-star read, or returns to the same world repeatedly. These should feel like contextual suggestions, not interruptions.

Do not show purchase prompts while the user is moving a book, rating spice, editing shelf data, or trying to leave a modal.

## Commerce rules

- Purchases belong to the account and follow the reader across devices.
- Every paid item must have a preview.
- Show the full price before checkout.
- Do not sell core shelf capacity, TBR size, book data, accessibility, or basic organization.
- Do not place ads inside personal libraries.
- Avoid consumable currencies for v1; price items directly in CAD.
- Bundles must show exactly what is included and credit already-owned eligible items when technically possible.
- A purchased visual item should continue working even if it is no longer featured in the store.

## V1 implementation priorities

1. Connect Stripe product and price IDs to the existing catalog.
2. Complete entitlement writing after successful checkout.
3. Restore purchases automatically on login.
4. Persist cabinet finish and detail selections per account.
5. Add preview/apply/owned states to the Library Atelier.
6. Instrument store views, previews, checkout starts, purchases, applies, and repeat use.
7. Add a simple purchase-history and restore-purchases screen.

## Metrics that decide what we build next

- Percentage of active readers who open the Atelier
- Preview-to-checkout rate by item and price
- Checkout completion rate
- First-purchase conversion rate
- Average order value
- Attachment rate: buyers who add an interaction to a world
- Repeat-purchase rate within 30 and 90 days
- Percentage of purchased items applied again after seven days
- Revenue per active reader without reducing bookcase engagement

The strongest signal is not merely that an item sold. It is that readers keep it applied, return to interact with it, and feel more ownership over their library.

## What we do not monetize

- Adding books
- Shelf capacity
- TBR capacity
- Moving books between shelves
- Spice ratings
- Book information and content warnings
- Accessibility settings
- Exporting or deleting a reader’s own data

The test is simple: if charging for something makes the library less trustworthy or less useful, it does not belong behind a purchase.
