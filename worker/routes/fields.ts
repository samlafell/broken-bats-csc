import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireAuth } from '../middleware/auth';

const fields = new Hono<{ Bindings: Bindings; Variables: Variables }>();

fields.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM fields ORDER BY date ASC, time_slot ASC'
  ).all();
  return c.json(results);
});

fields.post('/', requireAuth('admin'), async (c) => {
  const body = await c.req.json<{
    name: string;
    date: string;
    time_slot: string;
    status?: string;
  }>();

  const result = await c.env.DB.prepare(
    'INSERT INTO fields (name, date, time_slot, status) VALUES (?, ?, ?, ?)'
  )
    .bind(body.name, body.date, body.time_slot, body.status ?? 'Available')
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

fields.put('/:id', requireAuth('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    date?: string;
    time_slot?: string;
    status?: string;
  }>();

  const fieldList: string[] = [];
  const values: unknown[] = [];

  for (const [key, val] of Object.entries(body)) {
    if (val !== undefined) {
      fieldList.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (fieldList.length === 0) return c.json({ error: 'No fields to update' }, 400);

  fieldList.push("last_updated = datetime('now')");
  values.push(id);

  await c.env.DB.prepare(`UPDATE fields SET ${fieldList.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return c.json({ success: true });
});

// --- Field Bot endpoints ---

fields.post('/import', requireAuth('admin'), async (c) => {
  const body = await c.req.json<{
    targetDate: string;
    durationMs?: number;
    log?: string[];
    results: { fieldName: string; timeSlot: string; status: 'Available' | 'Booked' }[];
  }>();

  if (!body.targetDate || !Array.isArray(body.results)) {
    return c.json({ error: 'targetDate and results[] are required' }, 400);
  }

  if (body.results.length > 0) {
    const stmt = c.env.DB.prepare(
      `INSERT OR REPLACE INTO fields (name, date, time_slot, status, last_updated)
       VALUES (?, ?, ?, ?, datetime('now'))`
    );
    const batch = body.results.map((r) =>
      stmt.bind(r.fieldName, body.targetDate, r.timeSlot, r.status)
    );
    await c.env.DB.batch(batch);
  }

  const runStatus = body.results.length > 0 ? 'success' : 'partial';
  await c.env.DB.prepare(
    `INSERT INTO scrape_runs (target_date, status, slots_found, duration_ms, log)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      body.targetDate,
      runStatus,
      body.results.length,
      body.durationMs ?? 0,
      JSON.stringify(body.log ?? [`Imported ${body.results.length} slots via /api/fields/import`])
    )
    .run();

  return c.json({ imported: body.results.length, targetDate: body.targetDate, status: runStatus });
});

fields.post('/scrape', requireAuth('admin'), async (c) => {
  const { runFieldBot } = await import('../scraper/field-bot');
  const result = await runFieldBot(c.env);
  return c.json(result);
});

fields.get('/scrape-runs', requireAuth('admin'), async (c) => {
  const limit = Number(c.req.query('limit') ?? 20);
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM scrape_runs ORDER BY created_at DESC LIMIT ?'
  )
    .bind(limit)
    .all();
  return c.json(results);
});

export default fields;
