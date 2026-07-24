-- ═══════════════════════════════════════════════════════════════════════
-- smutHub bookcase store — products, entitlements and immersive worlds
-- Run after smuthub-bookshelf-schema.sql. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

alter table shelf_customization
  add column if not exists world_key text default 'moonlit';

create table if not exists bookcase_products (
  product_key       text primary key,
  product_type      text not null check (product_type in ('world','interaction','prop','bundle')),
  name              text not null,
  description       text,
  price_cents       integer not null check (price_cents >= 0),
  currency          text not null default 'cad',
  stripe_price_id   text unique,
  status            text not null default 'draft' check (status in ('draft','coming_soon','active','retired')),
  release_at        timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists user_bookcase_entitlements (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  product_key       text not null references bookcase_products(product_key) on delete restrict,
  source            text not null default 'purchase' check (source in ('purchase','gift','founder','admin','free')),
  stripe_session_id text unique,
  granted_at        timestamptz not null default now(),
  unique (user_id, product_key)
);

alter table bookcase_products enable row level security;
alter table user_bookcase_entitlements enable row level security;

drop policy if exists "public can read available bookcase products" on bookcase_products;
create policy "public can read available bookcase products"
  on bookcase_products for select
  using (status in ('coming_soon','active'));

drop policy if exists "users can read own bookcase entitlements" on user_bookcase_entitlements;
create policy "users can read own bookcase entitlements"
  on user_bookcase_entitlements for select
  using (auth.uid() = user_id);

-- Deliberately no client insert/update/delete policy for entitlements.
-- A verified Stripe webhook or service-role admin process must grant access.

insert into bookcase_products
  (product_key, product_type, name, description, price_cents, currency, status, metadata, sort_order)
values
  ('world_moonlit_reading_room','world','Moonlit Reading Room','The free immersive starter world.',0,'cad','active','{"world_key":"moonlit"}',10),
  ('world_candlelit_boudoir','world','Candlelit Boudoir','Rose velvet and warm brass launch world.',799,'cad','draft','{"world_key":"boudoir"}',20),
  ('pack_fairy_visitors','interaction','Fairy Visitors','Interactive fairy trio and hidden bookmark.',299,'cad','draft','{"interaction_key":"fairies"}',30),
  ('pack_witching_hour','interaction','The Witching Hour','Interactive clock with three time states.',299,'cad','draft','{"interaction_key":"clock"}',40),
  ('bundle_founders_sanctuary','bundle','Founder''s Sanctuary','Complete launch collection.',999,'cad','draft','{"includes":["world_candlelit_boudoir","pack_fairy_visitors","pack_witching_hour"]}',50)
on conflict (product_key) do update set
  product_type = excluded.product_type,
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  metadata = excluded.metadata,
  sort_order = excluded.sort_order,
  updated_at = now();
