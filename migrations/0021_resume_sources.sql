-- Additive archive: source copies are independent of generated review records.
-- Rollback the application without dropping these retained records or objects.
CREATE TABLE IF NOT EXISTS resume_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  request_id TEXT NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('original', 'snapshot')),
  payload_sha256 TEXT NOT NULL,
  original_source_id TEXT REFERENCES resume_sources(id),
  object_key TEXT,
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  file_size INTEGER NOT NULL DEFAULT 0,
  file_sha256 TEXT NOT NULL DEFAULT '',
  resume_text TEXT NOT NULL DEFAULT '',
  document_json TEXT NOT NULL DEFAULT '{}',
  target_role TEXT NOT NULL DEFAULT '',
  job_context TEXT NOT NULL DEFAULT '',
  position_json TEXT NOT NULL DEFAULT '{}',
  opportunity_id TEXT,
  resume_label TEXT NOT NULL DEFAULT '',
  extraction_status TEXT NOT NULL,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_resume_sources_owner_created
  ON resume_sources(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_resume_sources_opportunity
  ON resume_sources(user_id, opportunity_id, created_at DESC);

ALTER TABLE resume_records ADD COLUMN source_id TEXT REFERENCES resume_sources(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_records_source
  ON resume_records(user_id, source_id) WHERE source_id IS NOT NULL;
