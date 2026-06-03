ALTER TABLE waitlist_signups ADD COLUMN school_name TEXT;
ALTER TABLE waitlist_signups ADD COLUMN gpa REAL;
ALTER TABLE waitlist_signups ADD COLUMN certifications TEXT;

CREATE INDEX IF NOT EXISTS idx_waitlist_school_name
ON waitlist_signups (school_name);

CREATE INDEX IF NOT EXISTS idx_waitlist_gpa
ON waitlist_signups (gpa);
