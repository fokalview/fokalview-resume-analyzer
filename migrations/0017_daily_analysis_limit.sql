CREATE TABLE IF NOT EXISTS daily_analysis_usage (
  usage_date TEXT PRIMARY KEY,
  usage_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
