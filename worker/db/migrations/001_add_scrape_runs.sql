CREATE TABLE IF NOT EXISTS scrape_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  slots_found INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  log TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
