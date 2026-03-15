import puppeteer, { type Browser, type Page, type ElementHandle } from '@cloudflare/puppeteer';
import type { Bindings } from '../types';

export const TRACKED_FIELDS = [
  'Baileywick #1', 'Baileywick #2',
  'Cedar Hills #1',
  'Green Road #1', 'Green Road #2',
  'Honeycutt',
  'Kiwanis',
  'Lions #4',
  'Marsh Creek',
  'Oakwood #2',
  'Optimist #2',
] as const;

const SEARCH_URL = 'https://ncraleighweb.myvscloud.com/webtrac/web/search.html?module=FR&display=detail';

const FACILITY_FILTER_XPATH =
  '/html/body/div[1]/div[1]/div/div/form/div[1]/div[1]/div[1]/div[5]/div/div/div/ul';

interface TimeSlotResult {
  fieldName: string;
  date: string;
  timeSlot: string;
  status: 'Available' | 'Booked';
}

export interface ScrapeRunResult {
  targetDate: string;
  status: 'success' | 'partial' | 'error';
  slotsFound: number;
  durationMs: number;
  log: string[];
}

class ScrapeLogger {
  entries: string[] = [];

  info(msg: string) {
    const line = `[INFO] ${msg}`;
    this.entries.push(line);
    console.log(`[field-bot] ${msg}`);
  }

  warn(msg: string) {
    const line = `[WARN] ${msg}`;
    this.entries.push(line);
    console.warn(`[field-bot] ${msg}`);
  }

  error(msg: string) {
    const line = `[ERROR] ${msg}`;
    this.entries.push(line);
    console.error(`[field-bot] ${msg}`);
  }
}

/**
 * Compute the target date 15 days from now in America/New_York timezone.
 * Returns both an ISO date string (YYYY-MM-DD) for DB storage and
 * a US-formatted string (MM/DD/YYYY) for the site's date input.
 */
function getTargetDate(): { isoDate: string; usDate: string } {
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

/**
 * Select our tracked fields from the facility filter dropdown.
 * The dropdown is a <ul> with <li> items; clicking an <li> toggles selection.
 */
async function selectFacilityFilters(page: Page, log: ScrapeLogger): Promise<void> {
  const filterUl = await page.waitForSelector(
    '::-p-xpath(' + FACILITY_FILTER_XPATH + ')',
    { timeout: 15_000 }
  );
  if (!filterUl) throw new Error('Facility filter dropdown not found');

  const filterContainer = await filterUl.evaluateHandle((el) => el.closest('div'));
  if (filterContainer) {
    await (filterContainer as ElementHandle<HTMLElement>).click();
    await page.waitForSelector(
      '::-p-xpath(' + FACILITY_FILTER_XPATH + '/li)',
      { visible: true, timeout: 5_000 }
    );
  }

  const listItems = await filterUl.$$('li');
  log.info(`Found ${listItems.length} items in facility filter`);
  let selected = 0;

  for (const li of listItems) {
    const text = await li.evaluate((el) => el.textContent?.trim() ?? '');
    const match = TRACKED_FIELDS.some(
      (f) => text.toLowerCase().includes(f.toLowerCase())
    );
    if (match) {
      await li.click();
      selected++;
      log.info(`Selected filter: "${text}"`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (selected === 0) {
    log.warn('No matching fields found in filter dropdown. Available options:');
    for (const li of listItems.slice(0, 20)) {
      const text = await li.evaluate((el) => el.textContent?.trim() ?? '');
      log.warn(`  - "${text}"`);
    }
  } else {
    log.info(`Selected ${selected}/${TRACKED_FIELDS.length} tracked fields`);
  }
}

/**
 * Parse time-slot results from the search results page.
 * Each field result has time-block <span> pairs: the time text and a status span.
 * If the status span says "Unavailable", the slot is booked.
 */
async function parseResults(
  page: Page,
  isoDate: string
): Promise<TimeSlotResult[]> {
  return await page.evaluate(
    (trackedFields: string[], dateStr: string) => {
      const results: {
        fieldName: string;
        date: string;
        timeSlot: string;
        status: 'Available' | 'Booked';
      }[] = [];

      const resultItems = document.querySelectorAll(
        '.search-results-item, .result-item, [class*="result"], .detail-container, .activity-detail'
      );

      if (resultItems.length === 0) {
        const allSpans = Array.from(document.querySelectorAll('span'));
        for (let i = 0; i < allSpans.length; i++) {
          const spanText = allSpans[i].textContent?.trim() ?? '';
          const matchedField = trackedFields.find((f) =>
            spanText.toLowerCase().includes(f.toLowerCase())
          );
          if (matchedField) {
            let j = i + 1;
            while (j < allSpans.length) {
              const timeText = allSpans[j].textContent?.trim() ?? '';
              if (/\d{1,2}:\d{2}/.test(timeText)) {
                const nextSpan = allSpans[j + 1];
                const statusText = nextSpan?.textContent?.trim() ?? '';
                const isUnavailable =
                  statusText.toLowerCase() === 'unavailable';
                results.push({
                  fieldName: matchedField,
                  date: dateStr,
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
        }
      } else {
        for (const item of resultItems) {
          const title = item.querySelector(
            'h3, h4, .title, [class*="title"], .facility-name'
          );
          const fieldText = title?.textContent?.trim() ?? '';
          const matchedField = trackedFields.find((f) =>
            fieldText.toLowerCase().includes(f.toLowerCase())
          );
          if (!matchedField) continue;

          const spans = Array.from(item.querySelectorAll('span'));
          for (let i = 0; i < spans.length; i++) {
            const timeText = spans[i].textContent?.trim() ?? '';
            if (/\d{1,2}:\d{2}/.test(timeText)) {
              const nextSpan = spans[i + 1];
              const statusText = nextSpan?.textContent?.trim() ?? '';
              const isUnavailable =
                statusText.toLowerCase() === 'unavailable';
              results.push({
                fieldName: matchedField,
                date: dateStr,
                timeSlot: timeText,
                status: isUnavailable ? 'Booked' : 'Available',
              });
            }
          }
        }
      }

      return results;
    },
    [...TRACKED_FIELDS],
    isoDate
  );
}

/**
 * Upsert field availability rows into D1.
 * Uses INSERT OR REPLACE on the UNIQUE(name, date, time_slot) constraint.
 */
async function writeResults(
  db: D1Database,
  results: TimeSlotResult[],
  log: ScrapeLogger
): Promise<void> {
  if (results.length === 0) {
    log.warn('No time-slot results to write to DB');
    return;
  }

  const stmt = db.prepare(
    `INSERT OR REPLACE INTO fields (name, date, time_slot, status, last_updated)
     VALUES (?, ?, ?, ?, datetime('now'))`
  );

  const batch = results.map((r) =>
    stmt.bind(r.fieldName, r.date, r.timeSlot, r.status)
  );

  await db.batch(batch);
  log.info(`Wrote ${results.length} rows for ${results[0].date}`);
}

/**
 * Persist the scrape run result to the scrape_runs table.
 */
async function saveRunLog(
  db: D1Database,
  result: ScrapeRunResult
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO scrape_runs (target_date, status, slots_found, duration_ms, log)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        result.targetDate,
        result.status,
        result.slotsFound,
        result.durationMs,
        JSON.stringify(result.log)
      )
      .run();
  } catch (err) {
    console.error('[field-bot] Failed to save run log:', err);
  }
}

const REALISTIC_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * Wait for the Cloudflare challenge page to resolve.
 * Polls the page title — the challenge page has "Attention Required! | Cloudflare"
 * or "Just a moment..." titles. Once the title changes, the real page is loaded.
 */
async function waitForCfChallenge(
  page: Page,
  log: ScrapeLogger,
  maxWaitMs = 30_000
): Promise<boolean> {
  const start = Date.now();
  const CF_TITLES = ['attention required', 'just a moment', 'checking your browser'];

  let title = (await page.title()).toLowerCase();
  if (!CF_TITLES.some((t) => title.includes(t))) {
    return true;
  }

  log.info(`Cloudflare challenge detected (title: "${await page.title()}"). Waiting for it to resolve...`);

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 2_000));
    title = (await page.title()).toLowerCase();
    log.info(`Challenge poll — title: "${await page.title()}", elapsed: ${Date.now() - start}ms`);

    if (!CF_TITLES.some((t) => title.includes(t))) {
      log.info('Cloudflare challenge resolved');
      await new Promise((r) => setTimeout(r, 2_000));
      return true;
    }
  }

  log.error(`Cloudflare challenge did NOT resolve within ${maxWaitMs}ms`);
  return false;
}

/**
 * Main entry point for the field bot.
 * Launches a browser, scrapes the target date, writes to D1,
 * and returns a structured result with full logs.
 */
export async function runFieldBot(env: Bindings): Promise<ScrapeRunResult> {
  const log = new ScrapeLogger();
  const startTime = Date.now();
  const { isoDate, usDate } = getTargetDate();
  log.info(`Starting scrape for ${isoDate} (site input: ${usDate})`);

  let browser: Browser | null = null;
  let slotsFound = 0;
  let runStatus: ScrapeRunResult['status'] = 'error';

  try {
    log.info('Launching browser via BROWSER binding...');
    browser = await puppeteer.launch(env.BROWSER, { keep_alive: 60_000 });
    log.info('Browser launched');

    const page = await browser.newPage();

    await page.setUserAgent(REALISTIC_UA);
    await page.setViewport({ width: 1920, height: 1080 });
    log.info('Set realistic User-Agent and 1920x1080 viewport');

    // Mask headless browser signals
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    });

    log.info(`Navigating to ${SEARCH_URL}`);
    await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 45_000 });
    const pageTitle = await page.title();
    const pageUrl = page.url();
    log.info(`Page loaded — title: "${pageTitle}", url: ${pageUrl}`);

    // Handle Cloudflare challenge if present
    const challengeCleared = await waitForCfChallenge(page, log, 30_000);
    if (!challengeCleared) {
      // Dump what we can see for debugging
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      log.error(`Page text after challenge timeout:\n${bodyText}`);
      throw new Error('Cloudflare challenge did not resolve — site is blocking headless access');
    }

    // Re-check page state after challenge
    const postChallengeTitle = await page.title();
    const postChallengeUrl = page.url();
    log.info(`Post-challenge — title: "${postChallengeTitle}", url: ${postChallengeUrl}`);

    const bodyClasses = await page.evaluate(() => document.body.className);
    const formCount = await page.evaluate(() => document.querySelectorAll('form').length);
    log.info(`Page body classes: "${bodyClasses}", forms found: ${formCount}`);

    if (formCount === 0) {
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      log.warn(`No forms found on page. Body text:\n${bodyText}`);
    }

    log.info('Selecting facility filters...');
    await selectFacilityFilters(page, log);

    // Set the date input
    log.info('Looking for date input...');
    const dateInput = await page.$(
      'input[type="date"], input[name*="date"], input[name*="Date"], input[id*="date"], input[id*="Date"]'
    );
    if (dateInput) {
      const inputName = await dateInput.evaluate((el) => `name="${el.getAttribute('name')}" id="${el.getAttribute('id')}" type="${el.getAttribute('type')}"`);
      log.info(`Found date input: ${inputName}`);
      await dateInput.click({ clickCount: 3 });
      await dateInput.type(usDate);
      log.info(`Typed date: ${usDate}`);
    } else {
      log.warn('Date input not found via standard selectors. Dumping all inputs:');
      const inputDump = await page.evaluate(() =>
        Array.from(document.querySelectorAll('input')).map(
          (el) => `<input name="${el.name}" id="${el.id}" type="${el.type}" placeholder="${el.placeholder}">`
        )
      );
      for (const inp of inputDump) log.warn(`  ${inp}`);
    }

    // Submit the search form
    log.info('Looking for search/submit button...');
    const searchButton = await page.$(
      'button[type="submit"], input[type="submit"], [class*="search"] button, .btn-search'
    );
    if (searchButton) {
      const btnText = await searchButton.evaluate((el) => el.textContent?.trim() ?? el.getAttribute('value') ?? '(no text)');
      log.info(`Found submit button: "${btnText}"`);
      await searchButton.click();
    } else {
      log.warn('Submit button not found, pressing Enter as fallback');
      const allButtons = await page.evaluate(() =>
        Array.from(document.querySelectorAll('button, input[type="submit"]')).map(
          (el) => `<${el.tagName.toLowerCase()} type="${el.getAttribute('type')}" class="${el.className}">${el.textContent?.trim()}</${el.tagName.toLowerCase()}>`
        )
      );
      for (const btn of allButtons) log.warn(`  ${btn}`);
      await page.keyboard.press('Enter');
    }

    log.info('Waiting for search results...');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30_000 }).catch(() => {
      log.warn('waitForNavigation timed out or no navigation occurred (results may load dynamically)');
    });
    await new Promise((r) => setTimeout(r, 3_000));

    const resultUrl = page.url();
    log.info(`Results page URL: ${resultUrl}`);

    const resultPageInfo = await page.evaluate(() => {
      const spanCount = document.querySelectorAll('span').length;
      const h3Count = document.querySelectorAll('h3').length;
      const resultElements = document.querySelectorAll(
        '.search-results-item, .result-item, [class*="result"], .detail-container, .activity-detail'
      ).length;
      const bodyTextLength = document.body.innerText.length;
      const firstChunk = document.body.innerText.substring(0, 500);
      return { spanCount, h3Count, resultElements, bodyTextLength, firstChunk };
    });
    log.info(`Results page — spans: ${resultPageInfo.spanCount}, h3s: ${resultPageInfo.h3Count}, result-like elements: ${resultPageInfo.resultElements}, body text length: ${resultPageInfo.bodyTextLength}`);
    log.info(`First 500 chars of page text: ${resultPageInfo.firstChunk.replace(/\n/g, '\\n')}`);

    log.info('Parsing results...');
    const results = await parseResults(page, isoDate);
    slotsFound = results.length;
    log.info(`Parsed ${slotsFound} time slots`);

    if (slotsFound > 0) {
      const available = results.filter((r) => r.status === 'Available').length;
      const booked = results.filter((r) => r.status === 'Booked').length;
      log.info(`Breakdown: ${available} available, ${booked} booked`);
      await writeResults(env.DB, results, log);
      runStatus = 'success';
    } else {
      log.warn('Zero slots parsed — this likely means the page structure did not match expectations');
      runStatus = 'partial';
    }
  } catch (err) {
    const errMsg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack}` : String(err);
    log.error(`Scrape failed: ${errMsg}`);
    runStatus = 'error';
  } finally {
    if (browser) {
      try {
        await browser.close();
        log.info('Browser closed');
      } catch {
        log.warn('Browser close failed (may already be closed)');
      }
    }
  }

  const result: ScrapeRunResult = {
    targetDate: isoDate,
    status: runStatus,
    slotsFound,
    durationMs: Date.now() - startTime,
    log: log.entries,
  };

  await saveRunLog(env.DB, result);
  log.info(`Run complete — status: ${runStatus}, duration: ${result.durationMs}ms`);

  return result;
}
