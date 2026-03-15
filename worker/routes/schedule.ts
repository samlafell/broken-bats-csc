import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

const schedule = new Hono<{ Bindings: Bindings; Variables: Variables }>();

schedule.get('/', async (c) => {
  const next = c.req.query('next');

  if (next === 'true') {
    const result = await c.env.DB.prepare(
      "SELECT * FROM games WHERE result IS NULL ORDER BY date ASC, time ASC LIMIT 1"
    ).first();
    return c.json(result ?? null);
  }

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM games ORDER BY date DESC, time DESC'
  ).all();
  return c.json(results);
});

schedule.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('SELECT * FROM games WHERE id = ?').bind(id).first();
  if (!result) return c.json({ error: 'Game not found' }, 404);
  return c.json(result);
});

schedule.post('/', requireAuth('admin'), async (c) => {
  const body = await c.req.json<{
    opponent: string;
    date: string;
    time: string;
    location: string;
    field_name?: string;
  }>();

  const result = await c.env.DB.prepare(
    'INSERT INTO games (opponent, date, time, location, field_name) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(body.opponent, body.date, body.time, body.location, body.field_name ?? null)
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

schedule.put('/:id', requireAuth('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    opponent?: string;
    date?: string;
    time?: string;
    location?: string;
    field_name?: string;
    result?: string;
    score_us?: number;
    score_them?: number;
  }>();

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

  values.push(id);
  await c.env.DB.prepare(`UPDATE games SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ success: true });
});

schedule.delete('/:id', requireAuth('admin'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM games WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

export default schedule;
