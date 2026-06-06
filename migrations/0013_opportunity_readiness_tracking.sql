ALTER TABLE application_captures ADD COLUMN latest_readiness_score INTEGER;
ALTER TABLE application_captures ADD COLUMN latest_analysis_json TEXT;
ALTER TABLE application_captures ADD COLUMN analysis_history_json TEXT;
ALTER TABLE application_captures ADD COLUMN analysis_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE application_captures ADD COLUMN last_analyzed_at TEXT;

ALTER TABLE resume_records ADD COLUMN opportunity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_application_captures_last_analyzed
ON application_captures (last_analyzed_at DESC);

CREATE INDEX IF NOT EXISTS idx_resume_records_opportunity
ON resume_records (user_id, opportunity_id);
