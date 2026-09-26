CREATE TABLE IF NOT EXISTS review_save_receipts (
  review_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  application_id TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_save_receipts_user ON review_save_receipts(user_id);
