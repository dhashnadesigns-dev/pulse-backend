-- PULSE database schema
-- Run this in Supabase SQL editor to create all tables

-- Cities — one row per tracked city
create table if not exists cities (
  id            text primary key,        -- e.g. "cairo_eg"
  name          text not null,
  lat           float not null default 0,
  lng           float not null default 0,
  tier          text not null default 'standard',  -- breaking | major | standard
  dot_intensity float not null default 0,          -- 0–1, controls dot size/pulse
  story_count   int  not null default 0,
  last_story_at timestamptz
);

-- Articles — raw normalised articles from all sources
create table if not exists articles (
  id           bigserial primary key,
  title        text,
  url          text unique,
  subtext      text,                     -- AI-written context line (filled by editorial agent)
  source_name  text,
  published_at timestamptz,
  city_id      text references cities(id),
  cluster_id   bigint,
  lang         text default 'en',
  raw_tone     float default 0,
  created_at   timestamptz default now()
);

-- Clusters — grouped story events per city
create table if not exists clusters (
  id                   bigserial primary key,
  city_id              text references cities(id),
  canonical_article_id bigint references articles(id),
  tier                 text not null default 'standard',
  significance_score   int  not null default 0,
  story_count          int  not null default 1,
  first_seen_at        timestamptz default now(),
  last_updated_at      timestamptz default now()
);

-- User signals — sessions, city visits, email captures
create table if not exists user_signals (
  id                 bigserial primary key,
  session_id         text unique not null,
  visited_city_ids   text[] default '{}',
  email              text,
  email_captured_at  timestamptz,
  referrer           text,
  device_type        text,
  first_seen_at      timestamptz default now(),
  last_seen_at       timestamptz default now()
);

-- Editorial config — one row, updated by admin dashboard
create table if not exists editorial_config (
  id                   text primary key default 'default',
  ticker_speed         int  default 55,
  ticker_pause_hover   bool default true,
  ticker_breaking_hl   bool default true,
  ticker_max_items     int  default 15,
  ticker_email_freq    int  default 5,
  ticker_format        text default 'City · Headline snippet',
  ticker_email_copy    text default 'PULSE PRO COMING SOON · Be first to know →',
  subtext_style        text default 'Analytical',
  subtext_length       text default '1 sentence',
  subtext_instruction  text,
  headline_source      text default 'Highest trust source',
  headline_max_len     int  default 100,
  show_source_prefix   bool default false,
  region_weight        text default 'Balanced',
  breaking_min         int  default 80,
  major_min            int  default 40,
  velocity_mult        float default 3.0,
  min_sources          int  default 3,
  story_expiry         text default '48 hours',
  auto_deescalate      bool default true,
  updated_at           timestamptz default now()
);
insert into editorial_config (id) values ('default') on conflict do nothing;

-- Ingest run log — one row per pipeline execution
create table if not exists ingest_runs (
  id               bigserial primary key,
  source           text not null,
  started_at       timestamptz default now(),
  articles_fetched int  default 0,
  dupes_found      int  default 0,
  new_clusters     int  default 0,
  duration_ms      int  default 0,
  errors           text,
  manual_trigger   bool default false
);

-- API keys — stored by admin dashboard, read by ingest job
create table if not exists api_keys (
  key_name   text primary key,
  key_value  text not null,
  updated_at timestamptz default now()
);

-- Seed cities — initial set for the globe
insert into cities (id, name, lat, lng) values
  ('cairo_eg',      'Cairo',       30.04,  31.23),
  ('kyiv_ua',       'Kyiv',        50.45,  30.52),
  ('tokyo_jp',      'Tokyo',       35.68, 139.69),
  ('london_gb',     'London',      51.51,  -0.12),
  ('berlin_de',     'Berlin',      52.52,  13.40),
  ('paris_fr',      'Paris',       48.85,   2.35),
  ('moscow_ru',     'Moscow',      55.75,  37.62),
  ('beijing_cn',    'Beijing',     39.90, 116.40),
  ('mumbai_in',     'Mumbai',      19.08,  72.88),
  ('new_york_us',   'New York',    40.71, -74.00),
  ('washington_us', 'Washington',  38.90, -77.04),
  ('istanbul_tr',   'Istanbul',    41.01,  28.95),
  ('tehran_ir',     'Tehran',      35.69,  51.39),
  ('riyadh_sa',     'Riyadh',      24.69,  46.72),
  ('nairobi_ke',    'Nairobi',     -1.29,  36.82),
  ('lagos_ng',      'Lagos',        6.52,   3.38),
  ('seoul_kr',      'Seoul',       37.57, 126.98),
  ('bangkok_th',    'Bangkok',     13.75, 100.52),
  ('amman_jo',      'Amman',       31.95,  35.93),
  ('beirut_lb',     'Beirut',      33.89,  35.50)
on conflict do nothing;
