CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  client_hash TEXT NOT NULL UNIQUE,
  identifier_type TEXT NOT NULL DEFAULT 'client',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

ALTER TABLE application_captures ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE resume_records ADD COLUMN user_id TEXT REFERENCES users(id);

INSERT OR IGNORE INTO users (id, client_hash, identifier_type, created_at, last_seen_at)
SELECT
  'usr_' || substr(client_hash, 1, 16),
  client_hash,
  'client',
  MIN(captured_at),
  MAX(updated_at)
FROM application_captures
GROUP BY client_hash;

INSERT OR IGNORE INTO users (id, client_hash, identifier_type, created_at, last_seen_at)
SELECT
  'usr_' || substr(client_hash, 1, 16),
  client_hash,
  'client',
  MIN(captured_at),
  MAX(updated_at)
FROM resume_records
GROUP BY client_hash;

UPDATE application_captures
SET user_id = 'usr_' || substr(client_hash, 1, 16)
WHERE user_id IS NULL;

UPDATE resume_records
SET user_id = 'usr_' || substr(client_hash, 1, 16)
WHERE user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_application_captures_user_updated
ON application_captures (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resume_records_user_updated
ON resume_records (user_id, updated_at DESC);
