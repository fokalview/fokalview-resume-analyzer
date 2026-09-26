CREATE TABLE IF NOT EXISTS admin_access_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_access_events_created ON admin_access_events(created_at);
