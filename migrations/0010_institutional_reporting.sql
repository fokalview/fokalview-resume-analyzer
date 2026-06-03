ALTER TABLE waitlist_signups ADD COLUMN program_name TEXT;
ALTER TABLE waitlist_signups ADD COLUMN major_field TEXT;
ALTER TABLE waitlist_signups ADD COLUMN degree_level TEXT;
ALTER TABLE waitlist_signups ADD COLUMN class_year TEXT;
ALTER TABLE waitlist_signups ADD COLUMN student_status TEXT;
ALTER TABLE waitlist_signups ADD COLUMN seeking_status TEXT;
ALTER TABLE waitlist_signups ADD COLUMN domestic_international TEXT;

ALTER TABLE waitlist_followups ADD COLUMN employer TEXT;
ALTER TABLE waitlist_followups ADD COLUMN job_title TEXT;
ALTER TABLE waitlist_followups ADD COLUMN salary_amount INTEGER;
ALTER TABLE waitlist_followups ADD COLUMN salary_period TEXT;
ALTER TABLE waitlist_followups ADD COLUMN outcome_date TEXT;
ALTER TABLE waitlist_followups ADD COLUMN job_location TEXT;
ALTER TABLE waitlist_followups ADD COLUMN data_source TEXT;
ALTER TABLE waitlist_followups ADD COLUMN verification_status TEXT;

CREATE INDEX IF NOT EXISTS idx_waitlist_program_name
ON waitlist_signups (program_name);

CREATE INDEX IF NOT EXISTS idx_waitlist_major_field
ON waitlist_signups (major_field);

CREATE INDEX IF NOT EXISTS idx_waitlist_class_year
ON waitlist_signups (class_year);

CREATE INDEX IF NOT EXISTS idx_waitlist_domestic_international
ON waitlist_signups (domestic_international);

CREATE INDEX IF NOT EXISTS idx_followups_employer
ON waitlist_followups (employer);

CREATE INDEX IF NOT EXISTS idx_followups_job_title
ON waitlist_followups (job_title);

CREATE INDEX IF NOT EXISTS idx_followups_salary_amount
ON waitlist_followups (salary_amount);
