-- Account-bound 24-hour bookcase trials.
-- Apply after smuthub-bookcase-store-schema.sql.
--
-- The browser may request one trial per account and product. Only this
-- security-definer function can create a trial, so clearing browser storage
-- cannot restart it and client code cannot extend its expiry.

create table if not exists user_bookcase_trials (
  user_id      uuid not null references auth.users(id) on delete cascade,
  product_key text not null,
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  primary key (user_id, product_key),
  check (char_length(product_key) between 3 and 100),
  check (expires_at > started_at),
  check (expires_at <= started_at + interval '24 hours')
);

alter table user_bookcase_trials enable row level security;

drop policy if exists "users can read own bookcase trials" on user_bookcase_trials;
create policy "users can read own bookcase trials"
  on user_bookcase_trials for select
  using (auth.uid() = user_id);

-- Deliberately no client insert/update/delete policy. The function below is
-- the only grant path and never changes an existing trial.
create or replace function start_bookcase_trial(p_product_key text)
returns table (
  product_key text,
  started_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_product_key is null
     or char_length(p_product_key) not between 3 and 100
     or p_product_key !~ '^((cabinet|theme|detail):[a-z0-9-]+|(world|pack|bundle)_[a-z0-9_]+)$' then
    raise exception 'Invalid bookcase product key';
  end if;

  insert into user_bookcase_trials as trial
    (user_id, product_key, started_at, expires_at)
  values
    (v_user_id, p_product_key, now(), now() + interval '24 hours')
  on conflict (user_id, product_key) do nothing;

  return query
    select trial.product_key, trial.started_at, trial.expires_at
    from user_bookcase_trials as trial
    where trial.user_id = v_user_id
      and trial.product_key = p_product_key;
end;
$$;

revoke all on function start_bookcase_trial(text) from public;
grant execute on function start_bookcase_trial(text) to authenticated;

