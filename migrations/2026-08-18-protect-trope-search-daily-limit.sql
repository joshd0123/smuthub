create or replace function public.check_trope_search_rate_limit(
  p_visitor_hash text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  minute_start timestamptz := date_trunc('minute', p_now);
  hour_start timestamptz := date_trunc('hour', p_now);
  day_start timestamptz := date_trunc('day', p_now);
  minute_count integer;
  hour_count integer;
  day_count integer := 0;
  retry_after integer := 0;
begin
  if p_visitor_hash is null or length(p_visitor_hash) < 32 then
    return jsonb_build_object('allowed', false, 'retry_after', 60, 'reason', 'invalid_visitor');
  end if;

  delete from public.trope_search_rate_limits
  where window_start < p_now - interval '2 days';

  insert into public.trope_search_rate_limits (bucket_key, window_start, request_count, updated_at)
  values ('visitor:minute:' || p_visitor_hash || ':' || extract(epoch from minute_start)::bigint, minute_start, 1, p_now)
  on conflict (bucket_key) do update
    set request_count = public.trope_search_rate_limits.request_count + 1,
        updated_at = excluded.updated_at
  returning request_count into minute_count;

  insert into public.trope_search_rate_limits (bucket_key, window_start, request_count, updated_at)
  values ('visitor:hour:' || p_visitor_hash || ':' || extract(epoch from hour_start)::bigint, hour_start, 1, p_now)
  on conflict (bucket_key) do update
    set request_count = public.trope_search_rate_limits.request_count + 1,
        updated_at = excluded.updated_at
  returning request_count into hour_count;

  if minute_count > 5 then
    retry_after := greatest(retry_after, ceil(extract(epoch from minute_start + interval '1 minute' - p_now))::integer);
  end if;
  if hour_count > 20 then
    retry_after := greatest(retry_after, ceil(extract(epoch from hour_start + interval '1 hour' - p_now))::integer);
  end if;

  -- A visitor who is already blocked cannot exhaust the shared daily budget.
  if retry_after = 0 then
    insert into public.trope_search_rate_limits (bucket_key, window_start, request_count, updated_at)
    values ('global:day:' || extract(epoch from day_start)::bigint, day_start, 1, p_now)
    on conflict (bucket_key) do update
      set request_count = public.trope_search_rate_limits.request_count + 1,
          updated_at = excluded.updated_at
    returning request_count into day_count;

    if day_count > 1000 then
      retry_after := greatest(retry_after, ceil(extract(epoch from day_start + interval '1 day' - p_now))::integer);
    end if;
  end if;

  return jsonb_build_object(
    'allowed', retry_after = 0,
    'retry_after', greatest(retry_after, 0),
    'remaining_hour', greatest(20 - hour_count, 0),
    'reason', case
      when day_count > 1000 then 'daily_limit'
      when hour_count > 20 then 'hourly_limit'
      when minute_count > 5 then 'burst_limit'
      else 'ok'
    end
  );
end;
$$;

revoke all on function public.check_trope_search_rate_limit(text, timestamptz) from public, anon, authenticated;
grant execute on function public.check_trope_search_rate_limit(text, timestamptz) to service_role;

comment on function public.check_trope_search_rate_limit(text, timestamptz) is
  'Allows five valid requests per minute and twenty per hour per visitor. Only visitor-eligible requests consume the one-thousand-request global daily ceiling.';
