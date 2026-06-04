CREATE TABLE IF NOT EXISTS user_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  candidate_id TEXT,
  lead_id TEXT,
  event_type TEXT NOT NULL,
  event_source TEXT,
  page_path TEXT,
  session_id TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  campaign TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_events_type_created ON user_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_user_created ON user_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_session ON user_events (session_id);
CREATE INDEX IF NOT EXISTS idx_user_events_source ON user_events (event_source);
