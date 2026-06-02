CREATE TABLE IF NOT EXISTS platform_id_counters (
  id_type TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO platform_id_counters (id_type, next_value) VALUES
  ('lead', 1),
  ('contact', 1),
  ('organization', 1),
  ('candidate', 1),
  ('application', 1),
  ('pilot', 1),
  ('report', 1);

ALTER TABLE users ADD COLUMN candidate_id TEXT;
ALTER TABLE resume_records ADD COLUMN report_id TEXT;
ALTER TABLE application_captures ADD COLUMN application_id TEXT;

ALTER TABLE waitlist_signups ADD COLUMN lead_id TEXT;
ALTER TABLE waitlist_signups ADD COLUMN contact_id TEXT;
ALTER TABLE waitlist_signups ADD COLUMN organization_id TEXT;
ALTER TABLE waitlist_signups ADD COLUMN candidate_id TEXT;
ALTER TABLE waitlist_signups ADD COLUMN user_type TEXT;
ALTER TABLE waitlist_signups ADD COLUMN referral_source TEXT;
ALTER TABLE waitlist_signups ADD COLUMN buying_authority TEXT;
ALTER TABLE waitlist_signups ADD COLUMN timeline TEXT;
ALTER TABLE waitlist_signups ADD COLUMN lead_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE waitlist_signups ADD COLUMN lead_priority TEXT;
ALTER TABLE waitlist_signups ADD COLUMN recommended_action TEXT;
ALTER TABLE waitlist_signups ADD COLUMN score_breakdown_json TEXT;

CREATE INDEX IF NOT EXISTS idx_users_candidate_id
ON users (candidate_id);

CREATE INDEX IF NOT EXISTS idx_application_captures_application_id
ON application_captures (application_id);

CREATE INDEX IF NOT EXISTS idx_resume_records_report_id
ON resume_records (report_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_lead_id
ON waitlist_signups (lead_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_user_type
ON waitlist_signups (user_type);

CREATE INDEX IF NOT EXISTS idx_waitlist_lead_score
ON waitlist_signups (lead_score DESC);
