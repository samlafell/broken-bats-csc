#!/usr/bin/env node

/**
 * Field Bot — Scrapes Raleigh Parks & Rec (WebTrac) for baseball field
 * availability 15 days out, then pushes results to the Broken Bats API.
 *
 * Designed to run in GitHub Actions on a daily cron.
 *
 * Required env vars:
 *   ADMIN_PASSWORD  — Admin password for the Broken Bats API
 *   SITE_URL        — Base URL of the site (default: https://cscbrokenbats.org)
 */

import puppeteer from 'puppeteer';

const TRACKED_FIELDS = [
  'Baileywick #1', 'Baileywick #2',
  'Cedar Hills #1',
  'Green Road #1', 'Green Road #2',
  'Honeycutt',
  'Kiwanis',
  'Lions #4',
  'Marsh Creek',
  'Oakwood #2',
  'Optimist #2',
];

const WEBTRAC_BASE = 'https://ncraleighweb.myvscloud.com/webtrac/web';
const SITE_URL = process.env.SITE_URL || 'https://cscbrokenbats.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const log = [];
function info(msg)  { log.push(`[INFO] ${msg}`);  console.log(`[field-bot] ${msg}`); }
function warn(msg)  { log.push(`[WARN] ${msg}`);  console.warn(`[field-bot] ${msg}`); }
function error(msg) { log.push(`[ERROR] ${msg}`); console.error(`[field-bot] ${msg}`); }

function getTargetDate() {
  const now = new Date();
  const eastern = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  eastern.setDate(eastern.getDate() + 15);

  const year = eastern.getFullYear();
  const month = String(eastern.getMonth() + 1).padStart(2, '0');
  const day = String(eastern.getDate()).padStart(2, '0');

  return {
    isoDate: `${year}-${month}-${day}`,
    usDate: `${month}/${day}/${year}`,
  };
}

async function main() {
  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD env var is required');
    process.exit(1);
  }

  const startTime = Date.now();
  const { isoDate, usDate } = getTargetDate();
  info(`Target date: ${isoDate} (${usDate})`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  let results = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Step 1 — Load the initial search page to get a session + CSRF token
    info('Loading initial search page...');
    await page.goto(`${WEBTRAC_BASE}/search.html?module=FR&display=detail`, {
      waitUntil: 'networkidle2',
      timeout: 45_000,
    });

    const initialUrl = page.url();
    info(`Initial page loaded — URL: ${initialUrl}`);
    info(`Title: "${await page.title()}"`);

    // Extract CSRF token — it's in the URL query string after redirect
    let csrfToken = new URL(initialUrl).searchParams.get('_csrf_token');

    if (!csrfToken) {
      info('CSRF token not in URL, searching page...');
      csrfToken = await page.evaluate(() => {
        const input = document.querySelector('input[name="_csrf_token"]');
        if (input) return input.value;
        const meta = document.querySelector('meta[name="csrf-token"]');
        if (meta) return meta.getAttribute('content');
        const links = Array.from(document.querySelectorAll('a[href*="_csrf_token"]'));
        if (links.length > 0) {
          const u = new URL(links[0].href);
          return u.searchParams.get('_csrf_token');
        }
        return null;
      });
    }

    if (!csrfToken) {
      error('Could not find CSRF token anywhere on the page');
      const snippet = await page.evaluate(() => document.body.innerText.substring(0, 500));
      error(`Page text: ${snippet}`);
      throw new Error('Missing CSRF token');
    }

    info(`Got CSRF token: ${csrfToken.substring(0, 20)}...`);

    // Step 2 — Navigate to the search results for our target date
    const searchParams = new URLSearchParams({
      Action: 'Start',
      SubAction: '',
      _csrf_token: csrfToken,
      keywordoption: 'Match One',
      keyword: '',
      date: usDate,
      begintime: '07:00 am',
      frclass: '',
      type: '',
      subtype: '',
      frheadcount: '0',
      features1: '', features2: '', features3: '', features4: '',
      features5: '', features6: '', features7: '', features8: '',
      blockstodisplay: '23',
      primarycode: '',
      display: 'Detail',
      search: 'yes',
      page: '1',
      module: 'FR',
      multiselectlist_value: '',
      frwebsearch_buttonsearch: 'yes',
    });

    const searchUrl = `${WEBTRAC_BASE}/search.html?${searchParams.toString()}`;
    info('Navigating to search results...');
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45_000 });
    info(`Search page loaded — title: "${await page.title()}"`);

    // Step 3 — Parse time-slot results
    const pageInfo = await page.evaluate(() => ({
      spanCount: document.querySelectorAll('span').length,
      bodyLength: document.body.innerText.length,
      firstChunk: document.body.innerText.substring(0, 300),
    }));
    info(`Page stats — spans: ${pageInfo.spanCount}, body length: ${pageInfo.bodyLength}`);
    info(`First 300 chars: ${pageInfo.firstChunk.replace(/\n/g, '\\n')}`);

    results = await page.evaluate((trackedFields) => {
      const parsed = [];
      const allSpans = Array.from(document.querySelectorAll('span'));

      for (let i = 0; i < allSpans.length; i++) {
        const spanText = allSpans[i].textContent?.trim() ?? '';
        const matchedField = trackedFields.find((f) =>
          spanText.toLowerCase().includes(f.toLowerCase())
        );
        if (!matchedField) continue;

        let j = i + 1;
        while (j < allSpans.length) {
          const timeText = allSpans[j].textContent?.trim() ?? '';

          if (/\d{1,2}:\d{2}/.test(timeText)) {
            const nextSpan = allSpans[j + 1];
            const statusText = nextSpan?.textContent?.trim() ?? '';
            const isUnavailable = statusText.toLowerCase() === 'unavailable';
            parsed.push({
              fieldName: matchedField,
              timeSlot: timeText,
              status: isUnavailable ? 'Booked' : 'Available',
            });
            j += 2;
          } else if (
            trackedFields.some((f) =>
              timeText.toLowerCase().includes(f.toLowerCase())
            )
          ) {
            break;
          } else {
            j++;
          }
        }
      }

      return parsed;
    }, TRACKED_FIELDS);

    info(`Parsed ${results.length} time slots`);
    if (results.length > 0) {
      const avail = results.filter((r) => r.status === 'Available').length;
      const booked = results.filter((r) => r.status === 'Booked').length;
      info(`Breakdown: ${avail} available, ${booked} booked`);
    } else {
      warn('Zero slots found — page structure may not match expectations');
      // Dump more of the page for debugging
      const fullDump = await page.evaluate(() => document.body.innerText.substring(0, 2000));
      warn(`Extended page dump:\n${fullDump}`);
    }
  } finally {
    await browser.close();
    info('Browser closed');
  }

  // Step 4 — Push results to the Broken Bats API
  const durationMs = Date.now() - startTime;
  info(`Scrape took ${durationMs}ms. Pushing to API...`);

  const loginRes = await fetch(`${SITE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD, role: 'admin' }),
  });

  if (!loginRes.ok) {
    error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
    process.exit(1);
  }

  const { token } = await loginRes.json();
  if (!token) {
    error('Login returned no token');
    process.exit(1);
  }

  info('Authenticated with API');

  const importRes = await fetch(`${SITE_URL}/api/fields/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetDate: isoDate,
      durationMs,
      log,
      results,
    }),
  });

  if (!importRes.ok) {
    error(`Import failed: ${importRes.status} ${await importRes.text()}`);
    process.exit(1);
  }

  const importData = await importRes.json();
  info(`Import complete: ${JSON.stringify(importData)}`);
}

main().catch((err) => {
  error(`Fatal: ${err.message}\n${err.stack}`);
  process.exit(1);
});
