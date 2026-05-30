CREATE TABLE IF NOT EXISTS waitlist_signups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  email_domain TEXT,
  email_domain_type TEXT,
  organization TEXT,
  organization_type TEXT,
  role TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  linkedin_url TEXT,
  biggest_challenge TEXT,
  current_tools TEXT,
  desired_features TEXT,
  interview_interest INTEGER NOT NULL DEFAULT 0,
  beta_interest INTEGER NOT NULL DEFAULT 0,
  pilot_interest INTEGER NOT NULL DEFAULT 0,
  budget_interest INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created
ON waitlist_signups (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_waitlist_email_domain_type
ON waitlist_signups (email_domain_type);

CREATE INDEX IF NOT EXISTS idx_waitlist_organization_type
ON waitlist_signups (organization_type);

CREATE INDEX IF NOT EXISTS idx_waitlist_status
ON waitlist_signups (status);
