-- Append-only follow-up plans keep every saved revision and leave signups intact.
CREATE TABLE IF NOT EXISTS waitlist_outreach (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES waitlist_signups(id),
  revision INTEGER NOT NULL CHECK (revision > 0),
  status TEXT NOT NULL CHECK (status IN ('New', 'Contacted', 'Awaiting reply', 'Meeting scheduled', 'Pilot discussion', 'Closed')),
  owner TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  last_contact_date TEXT NOT NULL DEFAULT '',
  next_followup_date TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (lead_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_outreach_lead ON waitlist_outreach(lead_id, revision DESC);
