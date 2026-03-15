import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

const roster = new Hono<{ Bindings: Bindings; Variables: Variables }>();

roster.get('/', async (c) => {
  const sort = c.req.query('sort');
  const limit = c.req.query('limit');

  let query = 'SELECT * FROM players';
  if (sort === 'avg') {
    query += ' ORDER BY CAST(REPLACE(batting_avg, ".", "0.") AS REAL) DESC';
  } else {
    query += ' ORDER BY name ASC';
  }
  if (limit) {
    query += ` LIMIT ${parseInt(limit, 10)}`;
  }

  const { results } = await c.env.DB.prepare(query).all();
  return c.json(results);
});

roster.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare('SELECT * FROM players WHERE id = ?').bind(id).first();
  if (!result) return c.json({ error: 'Player not found' }, 404);
  return c.json(result);
});

roster.post('/', requireAuth('admin'), async (c) => {
  const body = await c.req.json<{
    name: string;
    nickname?: string;
    position: string;
    batting_avg?: string;
    fun_stat?: string;
    image_url?: string;
    status?: string;
  }>();

  const result = await c.env.DB.prepare(
    'INSERT INTO players (name, nickname, position, batting_avg, fun_stat, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(
      body.name,
      body.nickname ?? null,
      body.position,
      body.batting_avg ?? '.000',
      body.fun_stat ?? null,
      body.image_url ?? null,
      body.status ?? 'Active'
    )
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

roster.put('/:id', requireAuth('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    nickname?: string;
    position?: string;
    batting_avg?: string;
    fun_stat?: string;
    image_url?: string;
    status?: string;
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
  await c.env.DB.prepare(`UPDATE players SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ success: true });
});

roster.delete('/:id', requireAuth('admin'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM players WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

export default roster;
