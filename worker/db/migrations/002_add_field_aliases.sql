CREATE TABLE IF NOT EXISTS dim_field_aliases (
  tracked_name TEXT NOT NULL,
  webtrac_name TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tracked_name, webtrac_name)
);

-- Seed confirmed page-1 mappings (verified March 2026)
INSERT OR IGNORE INTO dim_field_aliases (tracked_name, webtrac_name, confirmed) VALUES
  ('Baileywick 1', 'Baileywick 1 Ballfield MAX Base 70 ft', 1),
  ('Baileywick 2', 'Baileywick 2 Ballfield MAX Base 60 ft', 1),
  ('Biltmore Hills 2', 'Biltmore 2 Ballfield MAX Base 80 ft', 1),
  ('Carolina Pines 1', 'Carolina Pines 1 Ballfield MAX Base 70 ft', 1),
  ('Carolina Pines 2', 'Carolina Pines 2 Ballfield MAX Base 70 ft', 1),
  ('Cedar Hills', 'Cedar Hills Ballfield MAX Base 90 ft', 1),
  ('Honeycutt', 'Honeycutt Ballfield MAX Base 90 ft', 1);
