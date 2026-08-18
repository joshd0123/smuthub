-- Durable signup-vs-signin classification for analytics.
-- Replaces the fragile 60-second created_at window in auth.js. The client fires
-- the `signup` Umami event exactly once per account — the first authenticated
-- load where this flag is still false — then sets it true, so no later login is
-- ever recounted as a signup, on any device.

alter table public.profiles
  add column if not exists signup_tracked boolean not null default false;

-- Backfill: every EXISTING account has already signed up. Mark them tracked so
-- their next login does NOT fire a brand-new `signup`. Without this, everyone
-- who joined before this shipped (incl. the comp/founder accounts) would inflate
-- the signup metric the next time they log in.
update public.profiles set signup_tracked = true where signup_tracked = false;

-- The client updates signup_tracked on the user's OWN row, so a self-update RLS
-- policy must exist. It almost certainly already does (users edit their own
-- display_name / theme / handle today), so only add one if it's missing.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE'
      and (coalesce(qual,'') ilike '%auth.uid()%'
        or coalesce(with_check,'') ilike '%auth.uid()%')
  ) then
    create policy "profiles self update" on public.profiles
      for update using (auth.uid() = id) with check (auth.uid() = id);
  end if;
end $$;
