-- Players (from Home.tsx ROSTER and Admin.tsx ROSTER_DATA)
INSERT INTO players (id, name, nickname, position, batting_avg, fun_stat, image_url, status) VALUES
  (1, 'Jimmy Carter', 'Wheels', 'CF', '.342', 'Pulled Hamstrings: 2', 'https://picsum.photos/seed/jimmy/400/500', 'Active'),
  (2, 'Dave Smith', 'The Wall', 'C', '.280', 'Kids: 3', 'https://picsum.photos/seed/dave/400/500', 'Active'),
  (3, 'Mike Johnson', 'Laser', 'SS', '.310', 'Day Job: Accountant', 'https://picsum.photos/seed/mike/400/500', 'Active'),
  (4, 'Tom Davis', 'Big Fly', '1B', '.295', 'Broken Bats: 4', 'https://picsum.photos/seed/tom/400/500', 'Injured');

-- Games (from Home.tsx Next Game card and Ticker.tsx)
INSERT INTO games (id, opponent, date, time, location, field_name, result, score_us, score_them) VALUES
  (1, 'Tigers', '2025-04-05', '10:00 AM', 'Centennial Park', 'Field 3', 'W', 5, 3),
  (2, 'Yankees', '2025-04-12', '10:00 AM', 'Centennial Park', 'Field 4', NULL, NULL, NULL);

-- RSVPs (no existing data, starting empty)

-- Posts (from Clubhouse.tsx Locker Room Board)
INSERT INTO posts (author_name, author_role, content, created_at) VALUES
  ('Manager Skip', 'manager', 'No metal cleats on Field 4 this week. Parks Dept is getting strict. Bring your turfs or molded.', datetime('now', '-2 hours')),
  ('Dave "The Wall" Smith', 'player', 'Who''s bringing the post-game cooler this week? I got it last time.', datetime('now', '-1 day'));

-- Dues (from Admin.tsx ROSTER_DATA and Clubhouse.tsx Front Office)
INSERT INTO dues (player_id, amount_paid, amount_total, season) VALUES
  (1, 300, 300, '2025'),
  (2, 150, 300, '2025'),
  (3, 0, 300, '2025'),
  (4, 300, 300, '2025');

-- Fields (from Admin.tsx FIELD_DATA)
INSERT INTO fields (name, date, time_slot, status) VALUES
  ('Centennial Park', '2025-04-12', '9AM-12PM', 'Available'),
  ('Elm Street Turf', '2025-04-12', '2PM-5PM', 'Available'),
  ('Memorial Field', '2025-04-13', '10AM-1PM', 'Booked');

-- Media Assets (from Home.tsx MEDIA_ASSETS)
INSERT INTO media_assets (name, file_type, file_size) VALUES
  ('Primary Logo', 'SVG', '12 KB'),
  ('Cap Insignia', 'SVG', '8 KB'),
  ('Wordmark', 'SVG', '15 KB');
