# Founder’s Key launch gate

## The immutable rule

> At least one genuinely premium themed bookshelf world must be live and
> touchable before SmutHub charges $29 for the Founder’s Key.

If the rule is not true, checkout remains closed. We either delay the Key or
sell a smaller offer whose delivered value is already live.

## The launch proof

**The Moonlit Reading Room** is the first premium world and the proof behind
the Founder’s Key promise.

It counts as live only while all of the following remain true:

- A logged-out visitor can enter it without creating an account.
- The clock, fairies, and candle each respond visibly when touched.
- Shelf sections, collection search, and book opening work.
- The experience works on current phone and desktop breakpoints.
- A signed-in reader can apply and save access they own or are trialling.
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

The durable promise is:

> Every SmutHub-created bookshelf world, current and future.

“SmutHub-created” keeps licensed collaborations and third-party goods outside
an unlimited obligation unless SmutHub explicitly includes them.

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

