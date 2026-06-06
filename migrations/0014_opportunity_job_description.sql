ALTER TABLE application_captures ADD COLUMN job_description TEXT;

CREATE INDEX IF NOT EXISTS idx_application_captures_company_title
ON application_captures (company, title);
