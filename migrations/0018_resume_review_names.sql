ALTER TABLE resume_records ADD COLUMN resume_label TEXT;

CREATE INDEX IF NOT EXISTS idx_resume_records_opportunity_updated
ON resume_records (user_id, opportunity_id, updated_at DESC);
