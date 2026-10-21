-- The two tables PulseMetrics itself owns.
--
-- Rule P-1: events hold a fixed event name and a random browser id, and nothing else.
-- There is deliberately no column for a page address, query string, IP address, user agent
-- or free-form properties. The only free text is `name`, and a pattern limits it.

create table sites (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references "user" (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  public_key text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
    check (public_key ~ '^[a-f0-9]{24}$'),
  event_count bigint not null default 0,
  created_at timestamptz not null default now()
);
create index sites_owner_id on sites (owner_id);

create table events (
  id bigint generated always as identity primary key,
  site_id uuid not null references sites (id) on delete cascade,
  anon_id text not null check (anon_id ~ '^[a-z0-9]{16,32}$'),
  name text not null check (name ~ '^[a-z][a-z0-9_]{1,39}$'),
  created_at timestamptz not null default now()
);
create index events_site_time on events (site_id, created_at);
create index events_site_name_anon on events (site_id, name, anon_id, created_at);
