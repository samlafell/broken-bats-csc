import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { hashPassword, createToken, verifyToken } from '../middleware/auth';

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

auth.post('/login', async (c) => {
  const body = await c.req.json<{
    password: string;
    role: 'player' | 'admin';
  }>();

  if (!body.password || !body.role) {
    return c.json({ error: 'Password and role are required' }, 400);
  }

  if (body.role !== 'player' && body.role !== 'admin') {
    return c.json({ error: 'Role must be player or admin' }, 400);
  }

  const hashed = await hashPassword(body.password);
  const expected =
    body.role === 'admin' ? c.env.ADMIN_PASSWORD_HASH : c.env.PLAYER_PASSWORD_HASH;

  if (hashed !== expected) {
    return c.json({ error: 'Invalid password' }, 401);
  }

  const token = await createToken(body.role, c.env.JWT_SECRET);
  return c.json({ token, role: body.role });
});

auth.get('/verify', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ valid: false }, 401);
  }

  const token = authHeader.slice(7);
  const result = await verifyToken(token, c.env.JWT_SECRET);

  if (!result) {
    return c.json({ valid: false }, 401);
  }

  return c.json({ valid: true, role: result.role });
});

export default auth;
