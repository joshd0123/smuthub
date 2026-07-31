# smutHub Bookcase v1

## Product promise

Every shelf is a doorway. A reader enters a shelf, discovers a world shaped by
their books, and makes that world their own.

The organizational features stay free. Revenue comes from optional cosmetic
worlds and interactive additions.

## V1 experience

1. The logged-out page sells the feeling first, then opens a populated sample
   shelf world without requiring an account.
2. A signed-in reader taps a shelf plaque to enter its immersive world.
3. The finished Moonlit Reading Room is publicly previewable and establishes
   the premium quality bar behind the Founder’s Key.
4. The room contains meaningful interactions:
   - wind the clock to move from midnight toward dawn;
   - call or settle the fairies;
   - dim or relight the reading candle;
   - open the featured book to reveal a saved reading memory.
5. The Shop & Decorate drawer previews products inside the reader's own room.
6. Purchased products become permanent account entitlements.

## Shelf capacity

- The immersive room displays six books per section on phones and ten on
  larger screens.
- Brass bookends and horizontal swipes move between physical shelf sections.
- The range control always states what is visible, for example `7–12 of 84`.
- Tapping the range opens a searchable collection drawer containing every book.
- Selecting a collection result returns to the exact shelf section containing
  that book.
- The exterior bookcase remains horizontally browsable and shows a visible
  overflow cue once a row exceeds its first display.

## Founder’s Key launch offer

The launch offer is the **$29 Founder’s Key for the first 100 paid founders**.
It includes every SmutHub-created bookshelf world, current and future. Moonlit
is the live, touchable proof; it remains freely previewable before purchase.

Individual world and add-on prices remain internal hypotheses during the
Founder launch. The live UI uses the diamond marker, account-bound 24-hour
trials, and explicit `Live`, `In development`, or `Planned` availability
instead of publishing prices for products that are not yet for sale.

## Release cadence

- **Live now:** Moonlit Reading Room, including its clock, candle and fairy
  interactions.
- **In development:** Candlelit Boudoir and Founder’s Sanctuary.
- **Planned:** Rainbound Archive, Dragon’s Hoard and Familiar Companions.
- **Seasonal concept:** Haunted Manor.

Dates stay off the public promise until a release has passed production QA.
The target internal rhythm after launch is one meaningful world every four to
six weeks and one smaller interaction pack between worlds.

## Commerce boundary

The browser may preview a product marked `Live`, but it never grants ownership.
Stripe Checkout confirms payment and a verified webhook writes the
entitlement. Entitlements and one-time trials are account-based so they follow
the reader across devices. Checkout remains absent until every item in
[`FOUNDERS-KEY-LAUNCH-GATE.md`](FOUNDERS-KEY-LAUNCH-GATE.md) passes.

## V1 success signals

- Share of signed-in readers who enter a shelf.
- Interaction rate inside the free world.
- Shop opens after an interaction, not only from navigation.
- Paid-world preview rate.
- Checkout start and completion rate by product.
- Wallpaper/export and share rate.
