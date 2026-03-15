import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

const rsvp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

rsvp.get('/', requireAuth('player'), async (c) => {
  const gameId = c.req.query('game_id');

  if (gameId) {
    const { results } = await c.env.DB.prepare(
      `SELECT r.*, p.name as player_name, p.nickname
       FROM rsvps r JOIN players p ON r.player_id = p.id
       WHERE r.game_id = ?
       ORDER BY r.created_at DESC`
    )
      .bind(gameId)
      .all();
    return c.json(results);
  }

  const { results } = await c.env.DB.prepare(
    `SELECT r.*, p.name as player_name, p.nickname
     FROM rsvps r JOIN players p ON r.player_id = p.id
     ORDER BY r.created_at DESC`
  ).all();
  return c.json(results);
});

rsvp.post('/', requireAuth('player'), async (c) => {
  const body = await c.req.json<{
    player_id: number;
    game_id: number;
    status: 'in' | 'out' | 'bench';
  }>();

  await c.env.DB.prepare(
    `INSERT INTO rsvps (player_id, game_id, status)
     VALUES (?, ?, ?)
     ON CONFLICT(player_id, game_id) DO UPDATE SET status = excluded.status, created_at = datetime('now')`
  )
    .bind(body.player_id, body.game_id, body.status)
    .run();

  return c.json({ success: true });
});

export default rsvp;
