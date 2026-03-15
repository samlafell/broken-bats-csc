import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

const dues = new Hono<{ Bindings: Bindings; Variables: Variables }>();

dues.get('/', requireAuth('player'), async (c) => {
  const playerId = c.req.query('player_id');
  const season = c.req.query('season');

  if (playerId) {
    const { results } = await c.env.DB.prepare(
      `SELECT d.*, p.name as player_name
       FROM dues d JOIN players p ON d.player_id = p.id
       WHERE d.player_id = ?
       ORDER BY d.season DESC`
    )
      .bind(playerId)
      .all();
    return c.json(results);
  }

  let query = `SELECT d.*, p.name as player_name
               FROM dues d JOIN players p ON d.player_id = p.id`;
  if (season) {
    query += ` WHERE d.season = '${season}'`;
  }
  query += ' ORDER BY p.name ASC';

  const { results } = await c.env.DB.prepare(query).all();
  return c.json(results);
});

dues.put('/:id', requireAuth('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    amount_paid?: number;
    amount_total?: number;
  }>();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.amount_paid !== undefined) {
    fields.push('amount_paid = ?');
    values.push(body.amount_paid);
  }
  if (body.amount_total !== undefined) {
    fields.push('amount_total = ?');
    values.push(body.amount_total);
  }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(id);
  await c.env.DB.prepare(`UPDATE dues SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ success: true });
});

export default dues;
