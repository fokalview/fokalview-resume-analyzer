ALTER TABLE users ADD COLUMN security_pin_hash TEXT;
ALTER TABLE users ADD COLUMN security_pin_set_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_security_pin_set
ON users (security_pin_set_at);
