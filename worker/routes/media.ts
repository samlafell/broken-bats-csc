import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';

const media = new Hono<{ Bindings: Bindings; Variables: Variables }>();

media.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM media_assets ORDER BY name ASC'
  ).all();
  return c.json(results);
});

export default media;
