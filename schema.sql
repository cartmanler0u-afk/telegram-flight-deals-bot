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

-- QG des agents IA (mini app /office) : un état JSON par utilisateur Telegram.
create table if not exists office_state (
  owner_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Bâtiment 0 (THE MADHOUSE) : le monde simulé, stocké à part du QG (plusieurs centaines de Ko).
-- cycle : garde monotone (on n'écrase jamais un monde plus avancé par un plus ancien).
-- lease_holder / lease_until : bail d'une instance du bot, pour qu'un monde ne soit jamais
-- simulé deux fois en parallèle (déploiement qui se chevauche, deuxième instance…).
-- Migration : sans action manuelle, le monde déjà présent dans office_state.state.world
-- est repris automatiquement au premier démarrage puis déplacé ici.
create table if not exists madhouse_world (
  owner_id text primary key,
  world jsonb,
  cycle bigint not null default 0,
  lease_holder text,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);
