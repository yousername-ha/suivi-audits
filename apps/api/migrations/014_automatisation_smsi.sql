ALTER TABLE grc_series ADD COLUMN checked_at timestamptz;
CREATE INDEX grc_series_checked ON grc_series(checked_at,object_id);
