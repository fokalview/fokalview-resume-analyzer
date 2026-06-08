ALTER TABLE users ADD COLUMN workos_user_id TEXT;
ALTER TABLE users ADD COLUMN auth_provider TEXT;
ALTER TABLE users ADD COLUMN verified_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_workos_user_id
  ON users (workos_user_id);
