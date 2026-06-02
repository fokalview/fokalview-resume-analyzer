ALTER TABLE waitlist_signups ADD COLUMN zip_postal TEXT;
ALTER TABLE waitlist_signups ADD COLUMN preferred_contact_method TEXT;
ALTER TABLE waitlist_signups ADD COLUMN branch_status TEXT;
ALTER TABLE waitlist_signups ADD COLUMN target_role TEXT;
ALTER TABLE waitlist_signups ADD COLUMN target_industry TEXT;
ALTER TABLE waitlist_signups ADD COLUMN experience_level TEXT;
ALTER TABLE waitlist_signups ADD COLUMN current_process TEXT;
ALTER TABLE waitlist_signups ADD COLUMN population_served TEXT;
ALTER TABLE waitlist_signups ADD COLUMN reporting_wish TEXT;
ALTER TABLE waitlist_signups ADD COLUMN branch_profile_json TEXT;

CREATE INDEX IF NOT EXISTS idx_waitlist_branch_status
ON waitlist_signups (branch_status);

CREATE INDEX IF NOT EXISTS idx_waitlist_target_industry
ON waitlist_signups (target_industry);

CREATE INDEX IF NOT EXISTS idx_waitlist_current_process
ON waitlist_signups (current_process);
