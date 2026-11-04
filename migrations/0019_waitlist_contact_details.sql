-- Preserve existing hashes; NULL contact fields identify historical records
-- whose readable contact details were not retained. No addresses are invented.
ALTER TABLE waitlist_signups ADD COLUMN email TEXT;
ALTER TABLE waitlist_signups ADD COLUMN phone TEXT;
ALTER TABLE waitlist_signups ADD COLUMN intake_details_json TEXT;

ALTER TABLE waitlist_followups ADD COLUMN email TEXT;
ALTER TABLE waitlist_followups ADD COLUMN phone TEXT;
ALTER TABLE waitlist_followups ADD COLUMN response_details_json TEXT;
