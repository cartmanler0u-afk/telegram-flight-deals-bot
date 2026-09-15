-- À exécuter une fois dans l'éditeur SQL de votre projet Supabase
-- (Supabase Dashboard > SQL Editor > New query > coller > Run).

create table if not exists bot_settings (
  id smallint primary key default 1,
  channel_id text,
  constraint bot_settings_single_row check (id = 1)
);

insert into bot_settings (id, channel_id)
values (1, null)
on conflict (id) do nothing;

create table if not exists feeds (
  id bigint generated always as identity primary key,
  url text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists routes (
  id text primary key,
  origin text not null,
  destination text not null,
  max_price numeric not null,
  currency text not null default 'EUR',
  created_at timestamptz not null default now()
);

create table if not exists seen_deals (
  id text primary key,
  seen_at timestamptz not null default now()
);
