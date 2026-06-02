ALTER TABLE waitlist_signups ADD COLUMN county TEXT;
ALTER TABLE waitlist_signups ADD COLUMN metro_area TEXT;
ALTER TABLE waitlist_signups ADD COLUMN workforce_region TEXT;

CREATE TABLE IF NOT EXISTS waitlist_followups (
  id TEXT PRIMARY KEY,
  lead_id TEXT,
  candidate_id TEXT,
  contact_id TEXT,
  email_hash TEXT,
  email_domain TEXT,
  email_domain_type TEXT,
  current_status TEXT,
  application_count INTEGER NOT NULL DEFAULT 0,
  interview_count INTEGER NOT NULL DEFAULT 0,
  offer_count INTEGER NOT NULL DEFAULT 0,
  placement_status TEXT,
  current_role TEXT,
  current_industry TEXT,
  salary_range TEXT,
  support_needed TEXT,
  notes TEXT,
  source TEXT,
  submitted_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_waitlist_followups_lead
ON waitlist_followups (lead_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_followups_candidate
ON waitlist_followups (candidate_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_followups_submitted
ON waitlist_followups (submitted_at DESC);
