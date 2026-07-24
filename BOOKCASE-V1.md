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
3. The free Moonlit Reading Room establishes the quality bar.
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

## Launch catalog

| Product | Price (CAD) | Role |
|---|---:|---|
| Moonlit Reading Room | Free | Acquisition and first-session magic |
| Candlelit Boudoir | $7.99 | Hero paid world |
| Fairy Visitors | $2.99 | Small interactive purchase |
| The Witching Hour | $2.99 | Small interactive purchase |
| Founder's Sanctuary | $9.99 | Launch bundle and best-value anchor |

Avoid individual $0.99 card checkouts at launch. They carry too much fixed
payment cost and friction. Singles can later be sold through credits or as
optional add-ons inside a larger checkout.

## Release cadence

- **Launch:** Moonlit Reading Room, Candlelit Boudoir, Fairy Visitors,
  The Witching Hour, Founder's Sanctuary.
- **August 2026:** The Rainbound Archive.
- **Late August 2026:** The Dragon's Hoard.
- **September 2026:** Familiar Companions.
- **October 2026:** The Haunted Manor seasonal world.

The target rhythm after launch is one meaningful world every four to six weeks
and one smaller interaction pack between worlds. Reuse the same scene engine;
new releases should mostly be art, configuration and one distinctive
interaction rather than new application architecture.

## Commerce boundary

The browser may preview any product, but it never grants ownership. Stripe
Checkout confirms payment and a verified webhook writes the entitlement.
Entitlements are account-based so purchases follow the reader across devices.

## V1 success signals

- Share of signed-in readers who enter a shelf.
- Interaction rate inside the free world.
- Shop opens after an interaction, not only from navigation.
- Paid-world preview rate.
- Checkout start and completion rate by product.
- Wallpaper/export and share rate.
