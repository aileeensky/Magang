-- 012: Restore Manual IKU data source and missing-data action fields.
-- Safe to run on databases that already contain these columns.
ALTER TABLE performance.iku_manual
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS missing_data_action text;
