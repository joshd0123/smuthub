-- ════════════════════════════════════════════════════════════════════════
-- SmutHub catalog: first-class book spine artwork
-- Safe to re-run after the normalized catalog migration.
-- ════════════════════════════════════════════════════════════════════════

alter table books add column if not exists spine_url text;
alter table books add column if not exists spine_source_url text;
alter table books add column if not exists spine_position smallint not null default 50;
alter table books add column if not exists spine_source text;
alter table books add column if not exists spine_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'books_spine_position_range'
      and conrelid = 'books'::regclass
  ) then
    alter table books
      add constraint books_spine_position_range
      check (spine_position between 0 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'books_spine_source_allowed'
      and conrelid = 'books'::regclass
  ) then
    alter table books
      add constraint books_spine_source_allowed
      check (
        spine_source is null or
        spine_source in ('official','author','licensed','community')
      );
  end if;
end $$;

comment on column books.spine_url is
  'Approved spine artwork. When null, the bookcase derives a spine from cover_url.';
comment on column books.spine_source_url is
  'Original external artwork URL retained when a spine is rehosted to SmutHub R2.';
comment on column books.spine_position is
  'Horizontal focal point from 0–100 used when positioning spine artwork.';
comment on column books.spine_source is
  'Provenance for rights review: official, author, licensed, or community.';

create or replace function set_book_spine(
  p_slug text,
  p_spine_url text default null,
  p_spine_position int default 50,
  p_spine_source text default 'official'
)
returns void
language plpgsql
security invoker
as $$
begin
  if not exists (
    select 1 from profiles pr
    where pr.id = auth.uid() and pr.is_admin
  ) then
    raise exception 'not authorized: admin only';
  end if;

  if p_spine_position < 0 or p_spine_position > 100 then
    raise exception 'spine position must be between 0 and 100';
  end if;

  if p_spine_source not in ('official','author','licensed','community') then
    raise exception 'invalid spine source';
  end if;

  update books
  set spine_url = nullif(trim(p_spine_url),''),
      spine_position = p_spine_position,
      spine_source = case
        when nullif(trim(p_spine_url),'') is null then null
        else p_spine_source
      end,
      spine_updated_at = now()
  where slug = p_slug;

  if not found then
    raise exception 'book not found: %', p_slug;
  end if;
end;
$$;

grant execute on function set_book_spine(text,text,int,text) to authenticated;

select
  count(*) filter (where spine_url is not null) as books_with_official_spines,
  count(*) filter (where spine_url is null) as books_using_cover_fallback
from books;
