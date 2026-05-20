#!/usr/bin/env node

/**
 * Remove malformed field rows and refresh scraped dates in production.
 *
 * Requires deployed worker with:
 *   - DELETE /api/fields/cleanup/malformed
 *   - POST /api/fields/import (replace-by-date semantics)
 *
 * Usage:
 *   ADMIN_PASSWORD=... node scripts/cleanup-and-refresh-fields.mjs
 *   ADMIN_PASSWORD=... node scripts/cleanup-and-refresh-fields.mjs 2026-06-04 2026-06-19
 */

import { scrapeForDate } from './field-bot-adhoc.mjs';
import { getDailyDateRange } from './field-config.mjs';

const SITE_URL = process.env.SITE_URL || 'https://cscbrokenbats.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function login() {
  const res = await fetch(`${SITE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD, role: 'admin' }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const { token } = await res.json();
  return token;
}

async function cleanupMalformed(token) {
  const res = await fetch(`${SITE_URL}/api/fields/cleanup/malformed`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Cleanup failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function summarizeDate(date) {
  const rows = await (await fetch(`${SITE_URL}/api/fields?date=${date}`)).json();
  if (!Array.isArray(rows)) return { date, error: rows };
  return {
    date,
    rows: rows.length,
    fields: new Set(rows.map((r) => r.name)).size,
    available: rows.filter((r) => r.status === 'Available').length,
    booked: rows.filter((r) => r.status === 'Booked').length,
    malformed: rows.filter((r) => String(r.time_slot).includes('Unavailable')).length,
    maxUpdated: rows.reduce((m, r) => (r.last_updated > m ? r.last_updated : m), ''),
  };
}

async function main() {
  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD env var is required');
    process.exit(1);
  }

  const dates =
    process.argv.slice(2).length > 0
      ? process.argv.slice(2)
      : getDailyDateRange(40);

  console.log(`Cleaning malformed rows at ${SITE_URL}...`);
  const token = await login();
  const cleanup = await cleanupMalformed(token);
  console.log(`Deleted ${cleanup.deleted} malformed row(s)`);

  console.log(`Refreshing ${dates.length} date(s): ${dates[0]} → ${dates.at(-1)}`);
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    console.log(`\n[${i + 1}/${dates.length}] ${date}`);
    try {
      const { results } = await scrapeForDate(date, { pushToApi: true, headless: true });
      const summary = await summarizeDate(date);
      console.log(`  imported ${results.length} slots →`, JSON.stringify(summary));
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
    }
  }

  console.log('\nFinal window check');
  for (const date of [dates[0], dates.at(-1)]) {
    console.log(JSON.stringify(await summarizeDate(date)));
  }
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
