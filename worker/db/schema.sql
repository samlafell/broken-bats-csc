DROP TABLE IF EXISTS scrape_runs;
DROP TABLE IF EXISTS dim_field_aliases;
DROP TABLE IF EXISTS dim_field_locations;
DROP TABLE IF EXISTS rsvps;
DROP TABLE IF EXISTS dues;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS fields;
DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS games;
DROP TABLE IF EXISTS players;

CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nickname TEXT,
  position TEXT NOT NULL,
  batting_avg TEXT DEFAULT '.000',
  fun_stat TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Injured', 'Inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opponent TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  location TEXT NOT NULL,
  field_name TEXT,
  result TEXT CHECK (result IN ('W', 'L', 'T', NULL)),
  score_us INTEGER,
  score_them INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rsvps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('in', 'out', 'bench')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(player_id, game_id)
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'player' CHECK (author_role IN ('manager', 'player')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE dues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  amount_paid REAL NOT NULL DEFAULT 0,
  amount_total REAL NOT NULL DEFAULT 300,
  season TEXT NOT NULL,
  UNIQUE(player_id, season)
);

CREATE TABLE fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Booked')),
  last_updated TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, date, time_slot)
);

CREATE TABLE media_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size TEXT,
  download_url TEXT
);

CREATE TABLE dim_field_locations (
  field_name TEXT PRIMARY KEY,
  map_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE dim_field_aliases (
  tracked_name TEXT NOT NULL,
  webtrac_name TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tracked_name, webtrac_name)
);

CREATE TABLE scrape_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  slots_found INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  log TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
