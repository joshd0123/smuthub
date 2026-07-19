# Companion beta release checklist

The website UI is safe to deploy before the database work. Until the migration
exists, nobody passes the beta access check and the Companion remains hidden.

## 1. Apply the database migration

Run `2026-07-18-companion-beta.sql` in the Supabase SQL editor.

## 2. Invite individual testers

Run this once for each existing SmutHub account:

```sql
insert into companion_beta_access (user_id, note)
select id, 'founding tester'
from auth.users
where email = 'reader@example.com'
on conflict (user_id) do update
set active = true, expires_at = null;
```

To pause access without deleting a tester's companion or history:

```sql
update companion_beta_access
set active = false
where user_id = (select id from auth.users where email = 'reader@example.com');
```

## 3. Deploy the Edge Function

```sh
supabase functions deploy companion-chat
```

Without an OpenAI key, the function deliberately returns a small shelf-aware
preview result. This is useful for testing access, persistence, and the UI.

To enable live AI, set the secret in the Supabase project (never in `config.js`):

```sh
supabase secrets set OPENAI_API_KEY=YOUR_KEY
supabase secrets set OPENAI_MODEL=gpt-5.6-terra
supabase functions deploy companion-chat
```

The default model is `gpt-5.6-terra`, selected for a balance of quality and
cost in conversational use. The function uses low reasoning and short outputs.

## 4. Smoke test

1. Signed out: `/companion.html` asks the visitor to sign in.
2. Signed in without access: the page says it is invitation-only; no Companion
   surface appears on Dashboard, Search, or Bookshelf.
3. Signed in with access: contextual Companion strips appear on Dashboard,
   Search, and Bookshelf. There is never a floating bubble or chat drawer.
4. Save a new name and archetype, reload, and verify they persist.
5. Run "Choose My Next Read." Confirm its single result names only books from
   that user's shelf and does not claim unavailable plot details.
6. Deep-link to `/companion.html?tool=book-match` and confirm the Book Match
   workspace opens automatically.
7. Disable the tester's access and confirm the room and contextual strips disappear.

## Current spoiler promise

The beta protects against invented or retrieved plot spoilers by giving the
model only SmutHub shelf rows, catalog metadata, and user-entered progress. It
does not yet provide chapter recaps. Do not market it as chapter-perfect until
SmutHub has reviewed, progress-indexed summaries.
