#!/usr/bin/env node

/**
 * Ad-hoc Field Scraper — Scrapes Raleigh Parks WebTrac for a specific date.
 *
 * Unlike field-bot-local.mjs (daily cron), this module exports a
 * `scrapeForDate()` function that the Discord bot can call on demand.
 * It also works standalone: `node scripts/field-bot-adhoc.mjs 2026-04-15`
 *
 * Env vars:
 *   ADMIN_PASSWORD  (required) — Admin password for the Broken Bats API
 *   SITE_URL        (optional) — Defaults to https://cscbrokenbats.org
 *   HEADLESS        (optional) — Set to "false" to watch the browser
 */

import puppeteer from 'puppeteer';

const TRACKED_FIELDS = [
  'Baileywick 1', 'Baileywick 2', 'Cedar Hills',
  'Green Road 1', 'Green Road 2', 'Honeycutt',
  'Kiwanis', 'Lions 4', 'Marsh Creek',
  'Oakwood 2', 'Optimist 2',
];

const WEBTRAC_BASE = 'https://ncraleighweb.myvscloud.com/webtrac/web';
const MAX_PAGES = 5;

// ---------------------------------------------------------------------------
// Parse one page of results (runs inside page.evaluate)
// ---------------------------------------------------------------------------

function parseResultsInBrowser(trackedFields) {
  const results = [];
  const allNames = [];
  const locations = [];

  const blocks = document.querySelectorAll('div.result-content');
  for (const block of blocks) {
    const nameEl = block.querySelector('h2 span');
    if (!nameEl) continue;

    const facilityName = nameEl.textContent.trim();
    allNames.push(facilityName);

    const matched = trackedFields.find((f) =>
      facilityName.toLowerCase().includes(f.toLowerCase())
    );
    if (!matched) continue;

    const mapLink = block.querySelector('.search-more a[href*="maps.google.com"]');
    if (mapLink) {
      locations.push({ fieldName: matched, mapUrl: mapLink.href });
    }

    const slotLinks = block.querySelectorAll('a.cart-button--state-block');
    for (const link of slotLinks) {
      const timeText = link.textContent.trim();
      if (!/\d{1,2}:\d{2}\s*[ap]m/i.test(timeText)) continue;

      results.push({
        fieldName: matched,
        timeSlot: timeText.replace(/\s+/g, ' '),
        status: link.classList.contains('success') ? 'Available' : 'Booked',
      });
    }

    const spans = block.querySelectorAll('span');
    for (let i = 0; i < spans.length; i++) {
      const spanText = spans[i].textContent.trim();
      if (!/\d{1,2}:\d{2}\s*[ap]m/i.test(spanText)) continue;
      const nextText = spans[i + 1]?.textContent?.trim() ?? '';
      if (nextText.toLowerCase() === 'unavailable') {
        results.push({
          fieldName: matched,
          timeSlot: spanText.replace(/\s+/g, ' '),
          status: 'Booked',
        });
      }
    }
  }

  return { results, allNames, locations };
}

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
 * @returns {Promise<{ results: Array, locations: Array, log: string[] }>}
 */
export async function scrapeForDate(isoDate, opts = {}) {
  const siteUrl = opts.siteUrl || process.env.SITE_URL || 'https://cscbrokenbats.org';
  const adminPassword = opts.adminPassword || process.env.ADMIN_PASSWORD;
  const headless = opts.headless ?? (process.env.HEADLESS !== 'false');
  const pushToApi = opts.pushToApi ?? true;

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

  const browser = await puppeteer.launch({
    headless: headless ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let allResults = [];
  const locationMap = new Map();

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

      const { results, allNames, locations } = await page.evaluate(
        parseResultsInBrowser,
        TRACKED_FIELDS
      );

      for (const loc of locations) {
        if (!locationMap.has(loc.fieldName)) {
          locationMap.set(loc.fieldName, loc.mapUrl);
        }
      }

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
  }

  return { results: allResults, locations: locationsArr, log, durationMs };
}

// ---------------------------------------------------------------------------
// CLI entry point: node scripts/field-bot-adhoc.mjs 2026-04-15
// ---------------------------------------------------------------------------

const isMain = !process.argv[1] || process.argv[1].endsWith('field-bot-adhoc.mjs');
if (isMain && process.argv[2]) {
  scrapeForDate(process.argv[2])
    .then(({ results }) => {
      console.log(`\nDone — ${results.length} slots scraped.`);
    })
    .catch((err) => {
      console.error(`Fatal: ${err.message}`);
      process.exit(1);
    });
}
