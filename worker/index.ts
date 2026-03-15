import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings, Variables } from './types';
import auth from './routes/auth';
import ticker from './routes/ticker';
import roster from './routes/roster';
import schedule from './routes/schedule';
import rsvpRoutes from './routes/rsvp';
import posts from './routes/posts';
import dues from './routes/dues';
import fields from './routes/fields';
import media from './routes/media';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath('/api');

app.use('*', cors());

app.route('/auth', auth);
app.route('/ticker', ticker);
app.route('/roster', roster);
app.route('/schedule', schedule);
app.route('/rsvp', rsvpRoutes);
app.route('/posts', posts);
app.route('/dues', dues);
app.route('/fields', fields);
app.route('/media', media);

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Bindings,
    ctx: ExecutionContext
  ) {
    const { runFieldBot } = await import('./scraper/field-bot');
    ctx.waitUntil(runFieldBot(env));
  },
};
