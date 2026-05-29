ALTER TABLE users ADD COLUMN email_domain TEXT;
ALTER TABLE users ADD COLUMN email_domain_type TEXT;
ALTER TABLE users ADD COLUMN country TEXT;

CREATE INDEX IF NOT EXISTS idx_users_email_domain_type
ON users (email_domain_type);

CREATE INDEX IF NOT EXISTS idx_users_country
ON users (country);
