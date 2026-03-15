import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

const posts = new Hono<{ Bindings: Bindings; Variables: Variables }>();

posts.get('/', requireAuth('player'), async (c) => {
  const limit = c.req.query('limit');
  let query = 'SELECT * FROM posts ORDER BY created_at DESC';
  if (limit) {
    query += ` LIMIT ${parseInt(limit, 10)}`;
  }

  const { results } = await c.env.DB.prepare(query).all();
  return c.json(results);
});

posts.post('/', requireAuth('player'), async (c) => {
  const body = await c.req.json<{
    author_name: string;
    author_role?: 'manager' | 'player';
    content: string;
  }>();

  const result = await c.env.DB.prepare(
    'INSERT INTO posts (author_name, author_role, content) VALUES (?, ?, ?)'
  )
    .bind(body.author_name, body.author_role ?? 'player', body.content)
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

export default posts;
