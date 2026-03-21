#!/usr/bin/env node

/**
 * Ad-hoc Field Scraper — Scrapes Raleigh Parks WebTrac for specific dates.
 *
 * Unlike field-bot-local.mjs (daily cron), this module exports a
 * `scrapeForDate()` function that the Discord bot can call on demand.
 *
 * CLI usage:
 *   node scripts/field-bot-adhoc.mjs 2026-04-15                  # single date
 *   node scripts/field-bot-adhoc.mjs 2026-04-15 2026-06-18       # date range
 *   node scripts/field-bot-adhoc.mjs 2026-04-15 2026-06-18 --discover
 *
 * All dates must be at least 15 days from today (Raleigh Parks lockout).
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
  MIN_DAYS_OUT,
  fetchAliases,
  saveAliases,
  parseResultsInBrowser,
  parseDateRange,
} from './field-config.mjs';

const WEBTRAC_BASE = 'https://ncraleighweb.myvscloud.com/webtrac/web';
const MAX_PAGES = 5;

// ---------------------------------------------------------------------------
// ISO → US date format
// ---------------------------------------------------------------------------

function isoToUs(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
}

// ---------------------------------------------------------------------------
// Core scraping function
// ---------------------------------------------------------------------------

/**
 * Scrape WebTrac for a specific date and push results to the Broken Bats API.
 *
 * @param {string} isoDate  Target date in YYYY-MM-DD format
 * @param {object} [opts]
 * @param {string} [opts.siteUrl]        API base URL (default: env SITE_URL)
 * @param {string} [opts.adminPassword]  Admin password (default: env ADMIN_PASSWORD)
 * @param {boolean} [opts.headless]      Run headless (default: env HEADLESS)
 * @param {boolean} [opts.pushToApi]     Push results to the API (default: true)
 * @param {boolean} [opts.discover]      Enable fuzzy discovery mode (default: env DISCOVER)
 * @returns {Promise<{ results: Array, locations: Array, log: string[], durationMs: number }>}
 */
export async function scrapeForDate(isoDate, opts = {}) {
  const siteUrl = opts.siteUrl || process.env.SITE_URL || 'https://cscbrokenbats.org';
  const adminPassword = opts.adminPassword || process.env.ADMIN_PASSWORD;
  const headless = opts.headless ?? (process.env.HEADLESS !== 'false');
  const pushToApi = opts.pushToApi ?? true;
  const discover = opts.discover ?? (process.env.DISCOVER === 'true');

  if (pushToApi && !adminPassword) {
    throw new Error('ADMIN_PASSWORD is required when pushToApi is true');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid date format "${isoDate}" — expected YYYY-MM-DD`);
  }

  const usDate = isoToUs(isoDate);
  const log = [];
  const _info = (msg) => { log.push(`[INFO] ${msg}`); console.log(`[adhoc-scrape] ${msg}`); };
  const _warn = (msg) => { log.push(`[WARN] ${msg}`); console.warn(`[adhoc-scrape] ${msg}`); };
  const _error = (msg) => { log.push(`[ERROR] ${msg}`); console.error(`[adhoc-scrape] ${msg}`); };

  const startTime = Date.now();
  _info(`Target date: ${isoDate} (${usDate})`);
  _info(`Discovery mode: ${discover}`);

  // Load existing aliases
  const aliasMap = await fetchAliases(siteUrl);
  _info(`Loaded ${aliasMap.size} existing aliases`);
  const aliasObj = Object.fromEntries(aliasMap);

  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let allResults = [];
  const locationMap = new Map();
  const allNewAliases = [];
  const allUnmatched = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    _info('Loading initial search page...');
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
    if (!csrfToken) {
      _error('Could not find CSRF token');
      throw new Error('Missing CSRF token');
    }
    _info(`Got CSRF token: ${csrfToken.substring(0, 20)}...`);

    _info('Submitting search with category=Athletic Field...');
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
    _info(`Search page loaded — "${await page.title()}"`);

    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
      await page.waitForSelector('div.result-content', { timeout: 15_000 }).catch(() => null);

      const { results, allNames, locations, newAliases, unmatchedFacilities } =
        await page.evaluate(parseResultsInBrowser, {
          trackedFields: TRACKED_FIELDS,
          aliasMap: aliasObj,
          discover,
        });

      for (const loc of locations) {
        if (!locationMap.has(loc.fieldName)) {
          locationMap.set(loc.fieldName, loc.mapUrl);
        }
      }
      allNewAliases.push(...newAliases);
      allUnmatched.push(...unmatchedFacilities);

      _info(`Page ${pageNum}: ${allNames.length} facilities, ${results.length} matched slots`);

      const matched = results.filter(
        (r) => !allResults.some(
          (e) => e.fieldName === r.fieldName && e.timeSlot === r.timeSlot
        )
      );
      allResults.push(...matched);

      const nextPage = pageNum + 1;
      const pagingInfo = await page.evaluate((targetPage) => {
        const pagingUl = document.querySelector('ul.paging');
        if (!pagingUl) return { found: false, reason: 'no ul.paging' };

        const allButtons = Array.from(pagingUl.querySelectorAll('button.paging__button'));
        const nextBtn = allButtons.find(
          (b) => b.getAttribute('data-click-set-value') === String(targetPage)
            && !b.classList.contains('paging__lastpage')
        );

        if (!nextBtn) return { found: false, reason: 'no button for target page' };

        nextBtn.click();
        return { found: true, clickedPage: targetPage };
      }, nextPage);

      if (!pagingInfo.found) {
        _info(`No more pages after page ${pageNum}`);
        break;
      }

      _info(`Navigating to page ${nextPage}...`);
      await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }

    const avail = allResults.filter((r) => r.status === 'Available').length;
    const booked = allResults.filter((r) => r.status === 'Booked').length;
    _info(`Total: ${allResults.length} slots (${avail} available, ${booked} booked)`);

    // Discovery summary
    if (allNewAliases.length > 0) {
      _info(`Discovered ${allNewAliases.length} new alias(es):`);
      for (const a of allNewAliases) {
        _info(`  "${a.trackedName}" ← "${a.webtracName}"`);
      }
    }
    if (allUnmatched.length > 0) {
      _warn(`${allUnmatched.length} facility name(s) could not be matched:`);
      for (const u of allUnmatched) {
        _warn(`  "${u.facilityName}" (best: "${u.bestCandidate}", score: ${u.score.toFixed(2)})`);
      }
    }
  } finally {
    await browser.close();
    _info('Browser closed');
  }

  const durationMs = Date.now() - startTime;
  const locationsArr = [...locationMap.entries()].map(([fieldName, mapUrl]) => ({ fieldName, mapUrl }));

  if (pushToApi) {
    _info(`Scrape took ${durationMs}ms — pushing to API...`);

    const loginRes = await fetch(`${siteUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword, role: 'admin' }),
    });

    if (!loginRes.ok) {
      const body = await loginRes.text();
      _error(`Login failed: ${loginRes.status} ${body}`);
      throw new Error(`API login failed: ${loginRes.status}`);
    }

    const { token } = await loginRes.json();
    _info('Authenticated with API');

    const importRes = await fetch(`${siteUrl}/api/fields/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetDate: isoDate,
        durationMs,
        log,
        results: allResults,
        locations: locationsArr,
      }),
    });

    if (!importRes.ok) {
      const body = await importRes.text();
      _error(`Import failed: ${importRes.status} ${body}`);
      throw new Error(`API import failed: ${importRes.status}`);
    }

    const importData = await importRes.json();
    _info(`Import complete: ${JSON.stringify(importData)}`);

    // Persist newly discovered aliases
    if (allNewAliases.length > 0) {
      _info(`Saving ${allNewAliases.length} new alias(es) to API...`);
      await saveAliases(siteUrl, token, allNewAliases);
      _info('Aliases saved');
    }
  }

  return { results: allResults, locations: locationsArr, log, durationMs };
}

// ---------------------------------------------------------------------------
// CLI entry point:
//   node scripts/field-bot-adhoc.mjs 2026-04-15                  # single date
//   node scripts/field-bot-adhoc.mjs 2026-04-15 2026-06-18       # date range
//   node scripts/field-bot-adhoc.mjs 2026-04-15 --discover
// ---------------------------------------------------------------------------

const isMain = !process.argv[1] || process.argv[1].endsWith('field-bot-adhoc.mjs');
if (isMain) {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const flags = process.argv.slice(2).filter((a) => a.startsWith('-'));
  const discover = flags.includes('--discover');

  if (args.length === 0) {
    console.error(`Usage: node field-bot-adhoc.mjs <start-date> [end-date] [--discover]`);
    console.error(`  Dates must be YYYY-MM-DD and at least ${MIN_DAYS_OUT} days from today.`);
    process.exit(1);
  }

  let dates;
  try {
    dates = parseDateRange(args[0], args[1]);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  console.log(`Scraping ${dates.length} date(s): ${dates[0]}${dates.length > 1 ? ` → ${dates[dates.length - 1]}` : ''}`);

  (async () => {
    let totalSlots = 0;
    for (let i = 0; i < dates.length; i++) {
      console.log(`\n[${i + 1}/${dates.length}] ${dates[i]}`);
      try {
        const { results } = await scrapeForDate(dates[i], { discover });
        totalSlots += results.length;
      } catch (err) {
        console.error(`  Failed: ${err.message}`);
      }
    }
    console.log(`\nDone — ${dates.length} date(s), ${totalSlots} total slots scraped.`);
  })().catch((err) => {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  });
}
