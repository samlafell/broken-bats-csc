#!/usr/bin/env node

/**
 * Field Bot (Local) — Runs Puppeteer on the Mac Mini to scrape Raleigh Parks
 * WebTrac for baseball field availability, then pushes results to the Broken
 * Bats API. Scrapes a rolling window of dates (+15 to +40 days out).
 *
 * See docs/webtrac-scraping.md for full site-structure reference.
 *
 * Env vars:
 *   ADMIN_PASSWORD  (required) — Admin password for the Broken Bats API
 *   SITE_URL        (optional) — Defaults to https://cscbrokenbats.org
 *   HEADLESS        (optional) — Set to "false" to watch the browser
 *   DISCOVER        (optional) — Set to "true" to enable fuzzy discovery mode
 */

import puppeteer from 'puppeteer';
import {
  TRACKED_FIELDS,
  fetchAliases,
  saveAliases,
  parseResultsInBrowser,
  getDailyDateRange,
} from './field-config.mjs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WEBTRAC_BASE = 'https://ncraleighweb.myvscloud.com/webtrac/web';
const SITE_URL = process.env.SITE_URL || 'https://cscbrokenbats.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const HEADLESS = process.env.HEADLESS !== 'false';
const DISCOVER = process.env.DISCOVER === 'true' || process.argv.includes('--discover');
const MAX_PAGES = 5;
const MAX_DAYS_OUT = 40;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const entries = [];
function info(msg)  { entries.push(`[INFO] ${msg}`);  console.log(`[field-bot] ${msg}`); }
function warn(msg)  { entries.push(`[WARN] ${msg}`);  console.warn(`[field-bot] ${msg}`); }
function error(msg) { entries.push(`[ERROR] ${msg}`); console.error(`[field-bot] ${msg}`); }

// ---------------------------------------------------------------------------
// Scrape a single date using an existing browser page + CSRF token
// ---------------------------------------------------------------------------

async function scrapeDate(page, csrfToken, isoDate, aliasObj) {
  const [year, month, day] = isoDate.split('-');
  const usDate = `${month}/${day}/${year}`;

  info(`--- Scraping ${isoDate} (${usDate}) ---`);

  const searchParams = new URLSearchParams({
    Action: 'Start',
    SubAction: '',
    _csrf_token: csrfToken,
    keywordoption: 'Match One',
    keyword: '',
    date: usDate,
    begintime: '07:00 am',
    frclass: '',
    category: 'Athletic Field',
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

  await page.goto(
    `${WEBTRAC_BASE}/search.html?${searchParams.toString()}`,
    { waitUntil: 'networkidle2', timeout: 60_000 }
  );

  let allResults = [];
  const locationMap = new Map();
  const newAliases = [];

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    await page.waitForSelector('div.result-content', { timeout: 15_000 }).catch(() => null);

    const { results, allNames, locations, newAliases: pageAliases } =
      await page.evaluate(parseResultsInBrowser, {
        trackedFields: TRACKED_FIELDS,
        aliasMap: aliasObj,
        discover: DISCOVER,
      });

    for (const loc of locations) {
      if (!locationMap.has(loc.fieldName)) locationMap.set(loc.fieldName, loc.mapUrl);
    }
    newAliases.push(...pageAliases);

    const deduped = results.filter(
      (r) => !allResults.some((e) => e.fieldName === r.fieldName && e.timeSlot === r.timeSlot)
    );
    allResults.push(...deduped);

    info(`  Page ${pageNum}: ${allNames.length} facilities, ${results.length} matched slots`);

    const nextPage = pageNum + 1;
    const pagingInfo = await page.evaluate((targetPage) => {
      const pagingUl = document.querySelector('ul.paging');
      if (!pagingUl) return { found: false };
      const btn = Array.from(pagingUl.querySelectorAll('button.paging__button')).find(
        (b) => b.getAttribute('data-click-set-value') === String(targetPage)
          && !b.classList.contains('paging__lastpage')
      );
      if (!btn) return { found: false };
      btn.click();
      return { found: true };
    }, nextPage);

    if (!pagingInfo.found) break;
    await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
  }

  const avail = allResults.filter((r) => r.status === 'Available').length;
  const booked = allResults.filter((r) => r.status === 'Booked').length;
  info(`  ${isoDate}: ${allResults.length} slots (${avail} avail, ${booked} booked)`);

  return {
    isoDate,
    results: allResults,
    locations: [...locationMap.entries()].map(([fieldName, mapUrl]) => ({ fieldName, mapUrl })),
    newAliases,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD env var is required');
    process.exit(1);
  }

  const dates = getDailyDateRange(MAX_DAYS_OUT);
  const startTime = Date.now();
  info(`Scraping ${dates.length} dates: ${dates[0]} → ${dates[dates.length - 1]}`);
  info(`Headless: ${HEADLESS}, Discovery: ${DISCOVER}`);

  const aliasMap = await fetchAliases(SITE_URL);
  info(`Loaded ${aliasMap.size} existing aliases`);
  const aliasObj = Object.fromEntries(aliasMap);

  const browser = await puppeteer.launch({
    headless: HEADLESS ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Authenticate once up front
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
  info('Authenticated with API');

  const allNewAliases = [];
  let totalSlots = 0;
  let totalAvail = 0;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Get CSRF token once
    await page.goto(
      `${WEBTRAC_BASE}/search.html?module=FR&display=detail`,
      { waitUntil: 'networkidle2', timeout: 60_000 }
    );

    let csrfToken = new URL(page.url()).searchParams.get('_csrf_token');
    if (!csrfToken) {
      csrfToken = await page.evaluate(() => {
        const input = document.querySelector('input[name="_csrf_token"]');
        if (input) return input.value;
        const link = document.querySelector('a[href*="_csrf_token"]');
        if (link) return new URL(link.href).searchParams.get('_csrf_token');
        return null;
      });
    }
    if (!csrfToken) throw new Error('Missing CSRF token');
    info(`Got CSRF token`);

    for (let i = 0; i < dates.length; i++) {
      const isoDate = dates[i];
      info(`[${i + 1}/${dates.length}] Scraping ${isoDate}...`);

      try {
        const { results, locations, newAliases } =
          await scrapeDate(page, csrfToken, isoDate, aliasObj);

        allNewAliases.push(...newAliases);
        totalSlots += results.length;
        totalAvail += results.filter((r) => r.status === 'Available').length;

        // Push results for this date
        const importRes = await fetch(`${SITE_URL}/api/fields/import`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetDate: isoDate,
            durationMs: 0,
            log: [`Batch scrape: ${isoDate}`],
            results,
            locations,
          }),
        });

        if (!importRes.ok) {
          warn(`Import failed for ${isoDate}: ${importRes.status}`);
        }
      } catch (err) {
        warn(`Error scraping ${isoDate}: ${err.message}`);
      }

      // Brief pause between dates to avoid hammering the site
      if (i < dates.length - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  } finally {
    await browser.close();
    info('Browser closed');
  }

  const durationMs = Date.now() - startTime;
  info(`\nDone — ${dates.length} dates, ${totalSlots} total slots (${totalAvail} available)`);
  info(`Total time: ${(durationMs / 1000 / 60).toFixed(1)} minutes`);

  // Save any new aliases discovered during the batch
  if (allNewAliases.length > 0) {
    const unique = [...new Map(allNewAliases.map((a) => [a.webtracName, a])).values()];
    info(`Saving ${unique.length} new alias(es)...`);
    await saveAliases(SITE_URL, token, unique);
  }

  // Log final scrape run summary
  await fetch(`${SITE_URL}/api/fields/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetDate: dates[dates.length - 1],
      durationMs,
      log: entries,
      results: [],
    }),
  });
}

main().catch((err) => {
  error(`Fatal: ${err.message}\n${err.stack}`);
  process.exit(1);
});
