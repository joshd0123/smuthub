# Founder’s Key launch gate

## The immutable rule

> At least one genuinely premium themed bookshelf world must be live and
> publicly previewable before SmutHub charges $29 for the Founder’s Key.

If the rule is not true, checkout remains closed. We either delay the Key or
sell a smaller offer whose delivered value is already live.

## The launch proof

**The Moonlit Reading Room** is the first premium world and the proof behind
the Founder’s Key promise. Access model (2026-08-07): a free logged-out
**preview** proves the world is real; **full entry is a one-time $4.99 unlock**
(a deliberate loss-leader), or free with the Founder’s Key / admin comp.

It counts as live only while all of the following remain true:

- A logged-out visitor can **preview** it without creating an account — they can
  see the real room and watch its interactions before paying.
- The clock, fairies, and candle each respond visibly when touched — demonstrated
  in the preview, so the world is provably real, not a screenshot.
- Shelf sections, collection search, and book opening work.
- The experience works on current phone and desktop breakpoints.
- A reader who owns Moonlit (bought the $4.99 unlock or holds the Key) can enter
  and save it; a free reader sees the preview and a clear unlock CTA.
- The purchase page links directly to the working preview.

A cabinet colour, static screenshot, concept card, CSS-only placeholder, or
“coming soon” room does not satisfy this gate.

## The $29 checkout gate

Checkout must fail closed until every item below is verified:

- [x] Moonlit Reading Room is publicly previewable.
- [x] Moonlit has at least three working interactions.
- [x] Mobile and desktop layouts have a viable interaction path.
- [ ] Account-bound 24-hour trials are deployed and verified.
- [ ] A verified checkout webhook grants the Founder’s Key entitlement.
- [ ] A successful purchase unlocks and persists Founder access.
- [ ] Founder numbers are assigned once, in order, with no duplicates.
- [ ] Remaining-Founder inventory comes from successful purchases, not copy.
- [ ] Refund or failed-payment handling removes access correctly.
- [ ] The Founder’s Key page links directly to Moonlit.
- [ ] Every item described as “live” has been tested in production.

The public CTA must not contain a checkout URL while any required item remains
unchecked.

## Promise language

The durable promise (revised 2026-08-07) is:

> Eight SmutHub-created immersive worlds free in a Founder’s first year, then
> founder pricing on every world and release after. All bookcase customization
> is free for every reader.

This replaces the earlier “every world, current and future” language, which
committed to an unbounded free obligation. Founders still come first on every
release and hold founder pricing for life. “SmutHub-created” keeps licensed
collaborations and third-party goods outside any obligation unless SmutHub
explicitly includes them.

Roadmap concepts must always be separated from delivered products:

- **Live now** means usable in production.
- **In development** means actively being built but not sold as delivered.
- **Planned** is directional and has no guaranteed date.
- **Founder exclusive** describes access, not availability; it must still say
  whether the item is live or in development.

## Source-of-truth rules

- The live Founder count comes from completed paid entitlements.
- Complimentary/admin access never consumes one of the first 100 paid places.
- Trial state belongs to the account, not browser storage.
- A preview never grants ownership.
- Only a verified server-side payment event grants paid ownership.
- No fake scarcity, illustrative counters, or checkout buttons that lead to a
  product that is not ready.

