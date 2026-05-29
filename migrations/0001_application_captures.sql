CREATE TABLE IF NOT EXISTS application_captures (
  id TEXT PRIMARY KEY,
  client_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  url TEXT,
  source TEXT,
  data_category TEXT NOT NULL DEFAULT 'job_application_context',
  consent_version TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_application_captures_client_updated
ON application_captures (client_hash, updated_at DESC);

CREATE TABLE IF NOT EXISTS resume_records (
  id TEXT PRIMARY KEY,
  client_hash TEXT NOT NULL,
  target_role TEXT,
  job_context TEXT,
  profile_json TEXT NOT NULL,
  analysis_json TEXT NOT NULL,
  raw_resume_text TEXT,
  raw_resume_retained INTEGER NOT NULL DEFAULT 0,
  data_category TEXT NOT NULL DEFAULT 'workforce_resume_profile',
  consent_version TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resume_records_client_updated
ON resume_records (client_hash, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resume_records_target_role
ON resume_records (target_role);
