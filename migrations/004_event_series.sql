-- Many-to-many: events ↔ series
CREATE TABLE IF NOT EXISTS event_series (
  event_id  UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  series_id UUID NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, series_id)
);

CREATE INDEX IF NOT EXISTS idx_event_series_series_id ON event_series(series_id);

-- Migrate existing single-series associations
INSERT INTO event_series (event_id, series_id)
SELECT id, series_id FROM events WHERE series_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop the old FK column
ALTER TABLE events DROP COLUMN IF EXISTS series_id;
