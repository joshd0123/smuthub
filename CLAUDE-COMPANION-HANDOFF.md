# SmutHub Companion beta — Claude Code handoff

## What this is

This branch contains v1 of a private, shelf-aware reading companion for premium
SmutHub users. It is intentionally **not a chatbot**. There is no floating
bubble, chat drawer, message transcript, or unsolicited popup.

The companion is presented as:

- a dedicated portrait-led “room” at `/companion.html`;
- a set of named abilities that each produce one standalone result card; and
- quiet, contextual invitations on Dashboard, Search, and My Bookshelf.

The visual language follows the existing site: near-black ink, rose-to-amber
gradient, Fraunces display type, Hanken Grotesk UI type, playful copy, compact
rounded cards, and mobile-first responsive behavior.

## Product rules to preserve

1. Never turn this into a generic support chat widget.
2. Never add a persistent floating launcher or transcript of speech bubbles.
3. Each ability should create an outcome: a pick, ritual, decision, match,
   safe orientation, shelf reading, or focused answer.
4. Companion presence on other pages must be inline and relevant to that page.
5. The companion may be warm, witty, and lightly flirtatious, but must not claim
   consciousness, dependence, exclusivity, or that it is a copyrighted character.
6. “Inspired archetypes” are fine; replicas of Xaden Riorson or other published
   characters are not.
7. OpenAI and service-role secrets stay server-side. Never put them in `config.js`.
8. Beta access must continue to be checked server-side in the Edge Function.

## Files and responsibilities

- `companion.html` — gated companion room, shelf snapshot, ability cards,
  one-shot ability workspace, profile settings, and local preview fixtures.
- `companion.css` — room, abilities, results, and reusable contextual strip.
- `companion.js` — beta access check, profile loading/saving, surface reveal,
  deep-link routing, and authenticated calls to the Edge Function.
- `companion-aren.png` — curated MMC guardian portrait.
- `companion-nyra.png` — curated FMC strategist portrait.
- `companion-sable.png` — curated dark-fae wildcard portrait.
- `dashboard.html` — allowlisted dashboard presence strip.
- `smuthub-app.html` — allowlisted Book Match strip near Search.
- `smuthub-bookcase.html` — allowlisted Choose For Me strip.
- `migrations/2026-07-18-companion-beta.sql` — allowlist, profile, reading
  progress, and private activity history tables with RLS.
- `supabase/functions/companion-chat/index.ts` — authenticated AI boundary. The
  legacy function name remains for deployment compatibility; the UI is not chat.
- `migrations/COMPANION-BETA.md` — operator release checklist.

## Ability IDs

These IDs are URL/API contracts. Preserve them or migrate deliberately:

| ID | Outcome |
|---|---|
| `next-read` | One pick from the user’s shelf/TBR with an evidence-based reason |
| `ritual` | A time-boxed reading ritual for tonight |
| `safe-catchup` | Progress-bounded orientation without later plot information |
| `shelf-reading` | Patterns inferred from shelf status and metadata |
| `book-match` | One shelf match for a requested feeling |
| `decider` | A clear read/switch/pause/DNF decision |
| `mood-rescue` | A short prescription for a slump or book hangover |
| `ask` | One focused bookish or everyday answer, not an ongoing conversation |

Deep links use `/companion.html?tool=<ability-id>`.

## Data and security flow

1. `auth.js` emits `sh-auth` with the current Supabase user.
2. `companion.js` selects the current user’s row from
   `companion_beta_access`. Its RLS policy returns a row only when access is
   active and unexpired.
3. Only then does the client reveal elements marked `data-companion-beta`.
4. Running an ability sends the access token, ability ID, prompt, page context,
   and small UI parameters to `companion-chat`.
5. The Edge Function validates the token and allowlist again, then loads the
   user’s profile, shelf, reading progress, and recent private activity.
6. With `OPENAI_API_KEY`, it calls the OpenAI Responses API. Without a key it
   returns a deterministic preview result so the release can be smoke-tested.
7. RLS restricts profiles, progress, and history to the owning user. There is no
   client insert/update/delete policy on the beta allowlist.

The current function defaults to `gpt-5.6-terra`, low reasoning, low verbosity,
500 maximum output tokens, and `store: false`. This was selected to balance
quality and cost for short, one-shot results.

## Spoiler contract and present limitation

The model receives only SmutHub shelf rows, user-entered progress, companion
settings, and recent activity. The system prompt forbids revealing or implying
plot events, identities, relationships, deaths, twists, endings, or later-series
facts absent from that data. Shelf status `read` is not permission to invent or
retrieve a plot summary.

This is conservative, not chapter-perfect. SmutHub does not yet have reviewed,
progress-indexed summaries. `safe-catchup` must therefore explain its boundary
instead of fabricating a recap. Do not market chapter-level recaps until that
content pipeline exists.

## Local preview

Serve the repository and open:

```text
http://localhost:4173/companion.html?preview=1&companion-preview=1
```

`preview=1` gives the full room realistic fixture data. `companion-preview=1`
lets `companion.js` reveal allowlisted surfaces locally without a Supabase user.
Neither flag grants production access because both require a localhost hostname.

## Production rollout

1. Merge/deploy the static site files.
2. Run `migrations/2026-07-18-companion-beta.sql` in the Supabase SQL editor.
3. Deploy with `supabase functions deploy companion-chat`.
4. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` with Supabase secrets.
5. Add specific tester user IDs using the SQL in `COMPANION-BETA.md`.
6. Smoke-test signed out, signed in without access, and signed in with access.
7. Test every ability against a sparse shelf, a full shelf, and no current read.
8. Explicitly probe for spoilers and verify refusal/boundary behavior.

The UI files are safe to deploy before the migration: without an allowlist row,
the contextual surfaces remain hidden and the room remains invitation-only.

## Recommended next steps

1. Add progress editing to the existing bookshelf UI so Safe Catch-Up has useful
   input without asking the user to repeat a chapter each time.
2. Add structured model output (`title`, `reason`, `actions`, `evidence`) so
   every ability can have a purpose-built visual result rather than plain text.
3. Use real cover images already known to the shelf instead of typographic
   placeholders in the companion room.
4. Make `initiative` control dashboard copy/frequency only. It must never create
   popups: quiet = room only, contextual = relevant inline strips, proactive =
   a dashboard greeting/brief.
5. Add privacy controls to view/delete companion activity and a clear explanation
   of what context is used.
6. Add rate limits and per-tier ability quotas before a broad paid launch.
7. Add voice only as an opt-in room mode with visible recording state and an
   immediate stop control. Do not imitate Siri or promise OS replacement.
8. Introduce image/persona customization in bounded stages: curated portraits,
   palette, archetype, wardrobe, environment, then generated variants with
   moderation and clear storage/deletion controls.

## Known implementation notes

- The table/function name `companion_messages` / `companion-chat` predates the
  no-chat redesign. It now acts as private ability activity/memory. Renaming is
  optional and should be done only with a careful migration.
- Friend reading activity and trending books are not included because there is
  not yet a trustworthy friend/privacy data contract in this repo. Do not fake it.
- Portrait customization and voice are future work. The settings currently store
  persona (`aren`, `nyra`, or `sable`), name, archetype, voice style label, presence mode,
  flirt level, and spoiler mode. Nyra changes both the portrait and server-side
  personality direction; she is not a cosmetic reskin.

- The site is intentionally static. Do not migrate it to a framework merely to
  extend this feature; preserve the existing HTML/CSS/JS + Supabase architecture.
