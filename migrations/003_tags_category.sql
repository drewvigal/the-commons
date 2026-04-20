ALTER TABLE tags ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
