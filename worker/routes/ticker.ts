import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';

const ticker = new Hono<{ Bindings: Bindings; Variables: Variables }>();

ticker.get('/', async (c) => {
  const lastGame = await c.env.DB.prepare(
    "SELECT * FROM games WHERE result IS NOT NULL ORDER BY date DESC, time DESC LIMIT 1"
  ).first();

  const nextGame = await c.env.DB.prepare(
    "SELECT * FROM games WHERE result IS NULL ORDER BY date ASC, time ASC LIMIT 1"
  ).first();

  const standings = await c.env.DB.prepare(
    "SELECT result, COUNT(*) as count FROM games WHERE result IS NOT NULL GROUP BY result"
  ).all();

  let wins = 0;
  let losses = 0;
  for (const row of standings.results) {
    if (row.result === 'W') wins = row.count as number;
    if (row.result === 'L') losses = row.count as number;
  }

  return c.json({
    lastGame: lastGame
      ? {
          result: lastGame.result,
          score_us: lastGame.score_us,
          score_them: lastGame.score_them,
          opponent: lastGame.opponent,
        }
      : null,
    nextGame: nextGame
      ? {
          opponent: nextGame.opponent,
          date: nextGame.date,
          time: nextGame.time,
          location: nextGame.location,
        }
      : null,
    standings: { wins, losses },
  });
});

export default ticker;
