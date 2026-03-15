import type { BrowserWorker } from '@cloudflare/puppeteer';

export type Bindings = {
  DB: D1Database;
  BROWSER: BrowserWorker;
  PLAYER_PASSWORD_HASH: string;
  ADMIN_PASSWORD_HASH: string;
  JWT_SECRET: string;
};

export type Variables = {
  role: 'player' | 'admin';
};
