-- =============================================================================
-- My Events Calendar — Initial Schema
-- Idempotent: safe to run multiple times against the same database.
-- Every DDL statement uses IF NOT EXISTS; every seed uses ON CONFLICT DO NOTHING.
-- =============================================================================

-- Required for gen_random_uuid() on Neon
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Migration tracking — must exist before the runner inserts the filename record
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   TEXT        PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLES (in FK dependency order)
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        UNIQUE NOT NULL,
  name        TEXT,
  avatar_url  TEXT,
  role        TEXT        NOT NULL DEFAULT 'user'
                          CHECK (role IN ('developer', 'admin', 'curator', 'user')),
  google_sub  TEXT        UNIQUE NOT NULL,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- series must exist before events (FK series_id → series.id)
CREATE TABLE IF NOT EXISTS series (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  slug        TEXT        UNIQUE NOT NULL,
  description TEXT,
  owner_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  summary       TEXT,
  description   TEXT,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  timezone      TEXT        NOT NULL,
  location_type TEXT        NOT NULL
                            CHECK (location_type IN ('in_person', 'virtual', 'hybrid')),
  address       TEXT,
  city          TEXT,
  state         TEXT,
  lat           NUMERIC(10,7),
  lng           NUMERIC(10,7),
  virtual_url   TEXT,
  event_url     TEXT,
  image_url     TEXT,
  series_id     UUID        REFERENCES series(id) ON DELETE SET NULL,
  owner_id      UUID        NOT NULL REFERENCES users(id),
  source_type   TEXT        NOT NULL
                            CHECK (source_type IN ('email', 'url', 'form', 'rss')),
  source_raw    TEXT,
  status        TEXT        NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'published', 'archived')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT UNIQUE NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_tags (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_id   UUID NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
  PRIMARY KEY (event_id, tag_id)
);

CREATE TABLE IF NOT EXISTS tag_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  requested_by UUID        REFERENCES users(id) ON DELETE SET NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_event_lists (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE TABLE IF NOT EXISTS ingestion_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT        NOT NULL CHECK (source_type IN ('email', 'url')),
  raw_input   TEXT,
  parsed_json JSONB,
  status      TEXT        NOT NULL CHECK (status IN ('success', 'failed', 'flagged')),
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO admin_settings (key, value) VALUES
  ('draft_notification_threshold', '5'),
  ('notification_email',           '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO tags (name, slug) VALUES
  ('Arts & Culture',        'arts-culture'),
  ('Civic',                 'civic'),
  ('Community Meetup',      'community-meetup'),
  ('Education & Workshops', 'education-workshops'),
  ('Food & Drink',          'food-drink'),
  ('Health & Wellness',     'health-wellness'),
  ('Kids & Family',         'kids-family'),
  ('Media & Film',          'media-film'),
  ('Music',                 'music'),
  ('Outdoors & Nature',     'outdoors-nature'),
  ('Spirituality & Faith',  'spirituality-faith'),
  ('Sports & Recreation',   'sports-recreation'),
  ('Technology',            'technology'),
  ('Virtual',               'virtual')
ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_events_status        ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_starts_at     ON events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_owner_id      ON events(owner_id);
CREATE INDEX IF NOT EXISTS idx_events_series_id     ON events(series_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_log_status ON ingestion_log(status);
