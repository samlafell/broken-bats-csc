#!/usr/bin/env node

/**
 * Field Bot (Local) — Runs Puppeteer on the Mac Mini to scrape Raleigh Parks
 * WebTrac for baseball field availability 15 days out, then pushes results to
 * the Broken Bats API.
 *
 * See docs/webtrac-scraping.md for full site-structure reference.
 *
 * Env vars:
 *   ADMIN_PASSWORD  (required) — Admin password for the Broken Bats API
 *   SITE_URL        (optional) — Defaults to https://cscbrokenbats.org
 *   HEADLESS        (optional) — Set to "false" to watch the browser
 */

import puppeteer from 'puppeteer';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TRACKED_FIELDS = [
  'Baileywick 1', 'Baileywick 2', 'Cedar Hills',
  'Green Road 1', 'Green Road 2', 'Honeycutt',
  'Kiwanis', 'Lions 4', 'Marsh Creek',
  'Oakwood 2', 'Optimist 2',
];

const WEBTRAC_BASE = 'https://ncraleighweb.myvscloud.com/webtrac/web';
const SITE_URL = process.env.SITE_URL || 'https://cscbrokenbats.org';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const HEADLESS = process.env.HEADLESS !== 'false';
const MAX_PAGES = 5;

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const entries = [];
function info(msg)  { entries.push(`[INFO] ${msg}`);  console.log(`[field-bot] ${msg}`); }
function warn(msg)  { entries.push(`[WARN] ${msg}`);  console.warn(`[field-bot] ${msg}`); }
function error(msg) { entries.push(`[ERROR] ${msg}`); console.error(`[field-bot] ${msg}`); }

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function getTargetDate() {
  const now = new Date();
  const eastern = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );
  eastern.setDate(eastern.getDate() + 14);

  const year = eastern.getFullYear();
  const month = String(eastern.getMonth() + 1).padStart(2, '0');
  const day = String(eastern.getDate()).padStart(2, '0');

  return {
    isoDate: `${year}-${month}-${day}`,
    usDate: `${month}/${day}/${year}`,
  };
}

// ---------------------------------------------------------------------------
// Parse one page of results (runs inside page.evaluate)
// ---------------------------------------------------------------------------

function parseResultsInBrowser(trackedFields) {
  const results = [];
  const allNames = [];

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

    // Available / booked <a> tags
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

    // Unavailable <span> pairs (fallback pattern)
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

  return { results, allNames };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!ADMIN_PASSWORD) {
    console.error('ADMIN_PASSWORD env var is required');
    process.exit(1);
  }

  const startTime = Date.now();
  const { isoDate, usDate } = getTargetDate();
  info(`Target date: ${isoDate} (${usDate})`);
  info(`Headless: ${HEADLESS}`);

  const browser = await puppeteer.launch({
    headless: HEADLESS ? 'new' : false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let allResults = [];

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // ----- Step 1: Load initial page to get CSRF token ----- //
    info('Step 1: Loading initial search page...');
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
      error('Could not find CSRF token');
      throw new Error('Missing CSRF token');
    }
    info(`Got CSRF token: ${csrfToken.substring(0, 20)}...`);

    // ----- Step 2: Navigate to search results with Athletic Field filter ----- //
    info('Step 2: Submitting search with category=Athletic Field...');
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
    info(`Search page loaded — "${await page.title()}"`);

    // ----- Step 3: Parse results across all pages ----- //
    info('Step 3: Parsing results...');

    for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
      await page.waitForSelector('div.result-content', { timeout: 15_000 }).catch(() => null);

      const { results, allNames } = await page.evaluate(
        parseResultsInBrowser,
        TRACKED_FIELDS
      );

      info(`Page ${pageNum}: ${allNames.length} facilities, ${results.length} matched slots`);
      if (allNames.length > 0) {
        info(`  Facilities: ${allNames.join(', ')}`);
      }

      const matched = results.filter(
        (r) => !allResults.some(
          (e) => e.fieldName === r.fieldName && e.timeSlot === r.timeSlot
        )
      );
      allResults.push(...matched);

      // Try to click the next page button
      // Pagination: <ul class="paging"> with <button class="paging__button" data-click-set-value="N">
      // Current page button has additional class "primary"
      const nextPage = pageNum + 1;
      const pagingInfo = await page.evaluate((targetPage) => {
        const pagingUl = document.querySelector('ul.paging');
        if (!pagingUl) return { found: false, reason: 'no ul.paging' };

        const allButtons = Array.from(pagingUl.querySelectorAll('button.paging__button'));
        const nextBtn = allButtons.find(
          (b) => b.getAttribute('data-click-set-value') === String(targetPage)
            && !b.classList.contains('paging__lastpage')
        );

        if (!nextBtn) return {
          found: false,
          reason: 'no button for target page',
          buttonValues: allButtons.map((b) => b.getAttribute('data-click-set-value')),
        };

        nextBtn.click();
        return { found: true, clickedPage: targetPage };
      }, nextPage);

      if (!pagingInfo.found) {
        info(`  No more pages after page ${pageNum} (${pagingInfo.reason})`);
        break;
      }

      info(`  Navigating to page ${nextPage}...`);
      await page.waitForNetworkIdle({ timeout: 15_000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }

    info(`Total: ${allResults.length} time slots across all pages`);
    if (allResults.length > 0) {
      const avail = allResults.filter((r) => r.status === 'Available').length;
      const booked = allResults.filter((r) => r.status === 'Booked').length;
      info(`Breakdown: ${avail} available, ${booked} booked`);
      const fields = [...new Set(allResults.map((r) => r.fieldName))];
      info(`Fields found: ${fields.join(', ')}`);
    } else {
      warn('Zero slots found — check docs/webtrac-scraping.md for debugging');
    }
  } finally {
    await browser.close();
    info('Browser closed');
  }

  // ----- Step 4: Push results to the Broken Bats API ----- //
  const durationMs = Date.now() - startTime;
  info(`Scrape took ${durationMs}ms — pushing to API...`);

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

  const importRes = await fetch(`${SITE_URL}/api/fields/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      targetDate: isoDate,
      durationMs,
      log: entries,
      results: allResults,
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
