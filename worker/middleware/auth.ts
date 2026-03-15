import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../types';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function createToken(
  role: 'player' | 'admin',
  secret: string
): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    })
  );
  const unsigned = `${header}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(unsigned));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${unsigned}.${sig}`;
}

async function verifyToken(
  token: string,
  secret: string
): Promise<{ role: 'player' | 'admin' } | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;
  const unsigned = `${header}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = Uint8Array.from(
    atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );

  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(unsigned));
  if (!valid) return null;

  try {
    const data = JSON.parse(atob(payload));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return { role: data.role };
  } catch {
    return null;
  }
}

export { hashPassword, createToken, verifyToken };

/**
 * Middleware that requires a valid auth token with at least the given role.
 * "player" allows both player and admin tokens.
 * "admin" allows only admin tokens.
 */
export function requireAuth(minRole: 'player' | 'admin') {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.slice(7);
    const result = await verifyToken(token, c.env.JWT_SECRET);

    if (!result) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    if (minRole === 'admin' && result.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    c.set('role', result.role);
    await next();
  });
}
