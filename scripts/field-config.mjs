/**
 * Shared field configuration and matching logic for the scraper scripts.
 *
 * Both field-bot-local.mjs and field-bot-adhoc.mjs import from here so the
 * tracked-field list, alias handling, and fuzzy discovery logic live in one
 * place.
 */

// Raleigh Parks locks availability at ~14 days out; day 15 is the first usable day.
export const MIN_DAYS_OUT = 15;

// Bobby's 25-field list (updated March 2026)
export const TRACKED_FIELDS = [
  'Baileywick 1', 'Baileywick 2', 'Biltmore Hills 2',
  'Carolina Pines 1', 'Carolina Pines 2', 'Cedar Hills',
  'Honeycutt', 'Jaycee 1', 'Jaycee 2', 'Lake Lynn',
  'Laurel Hills 1', 'Laurel Hills 2', 'Lions 1',
  'Lions 2', 'Lions 3', 'Lions 4', 'Marsh Creek',
  'Millbrook 1', 'Millbrook 2', 'Oakwood 1',
  'Optimist 2', 'Pullen 1', 'Pullen 2',
  'Sanderford 1', 'Worthdale 1',
];

// ---------------------------------------------------------------------------
// Alias helpers — load/save the webtrac_name ↔ tracked_name mapping via API
// ---------------------------------------------------------------------------

/**
 * Fetch existing aliases from the API. Returns a Map<webtracName, trackedName>.
 * Falls back to an empty map on failure so scraping can proceed.
 */
export async function fetchAliases(siteUrl) {
  try {
    const res = await fetch(`${siteUrl}/api/fields/aliases`);
    if (!res.ok) return new Map();
    const rows = await res.json();
    const map = new Map();
    for (const r of rows) {
      map.set(r.webtrac_name, r.tracked_name);
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Push newly discovered aliases to the API.
 * @param {{ trackedName: string; webtracName: string }[]} aliases
 */
export async function saveAliases(siteUrl, token, aliases) {
  if (aliases.length === 0) return;
  await fetch(`${siteUrl}/api/fields/aliases`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ aliases }),
  });
}

// ---------------------------------------------------------------------------
// Fuzzy matching — zero external dependencies
// ---------------------------------------------------------------------------

const STRIP_RE = /\b(ballfield|ball\s*field|max\s+base\s+\d+\s*ft|park)\b/gi;

function normalize(s) {
  return s.toLowerCase().replace(STRIP_RE, '').replace(/[#]/g, '').replace(/\s+/g, ' ').trim();
}

function tokenize(s) {
  return normalize(s).split(/\s+/).filter(Boolean);
}

/**
 * Score how well a WebTrac facility name matches a tracked field name.
 * Returns a value between 0 and 1. A score of 1 means every token from the
 * tracked name appears in the facility name.
 */
export function fuzzyScore(trackedName, facilityName) {
  const trackedTokens = tokenize(trackedName);
  const facilityTokens = tokenize(facilityName);
  if (trackedTokens.length === 0) return 0;

  let matched = 0;
  for (const t of trackedTokens) {
    if (facilityTokens.some((f) => f === t || f.startsWith(t) || t.startsWith(f))) {
      matched++;
    }
  }
  return matched / trackedTokens.length;
}

const FUZZY_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
// parseResultsInBrowser — runs inside page.evaluate()
//
// This function is serialised into the browser context by Puppeteer, so it
// CANNOT reference any outer-scope variables.  All data it needs is passed
// via the `ctx` argument.
// ---------------------------------------------------------------------------

/**
 * @param {{ trackedFields: string[], aliasMap: Record<string, string>, discover: boolean }} ctx
 */
export function parseResultsInBrowser(ctx) {
  const { trackedFields, aliasMap, discover } = ctx;

  // Rebuild fuzzy helpers inside the browser context (no access to outer scope)
  const STRIP = /\b(ballfield|ball\s*field|max\s+base\s+\d+\s*ft|park)\b/gi;
  function _normalize(s) {
    return s.toLowerCase().replace(STRIP, '').replace(/[#]/g, '').replace(/\s+/g, ' ').trim();
  }
  function _tokenize(s) { return _normalize(s).split(/\s+/).filter(Boolean); }
  function _fuzzyScore(tracked, facility) {
    const tt = _tokenize(tracked);
    const ft = _tokenize(facility);
    if (tt.length === 0) return 0;
    let m = 0;
    for (const t of tt) {
      if (ft.some((f) => f === t || f.startsWith(t) || t.startsWith(f))) m++;
    }
    return m / tt.length;
  }

  const results = [];
  const allNames = [];
  const locations = [];
  const newAliases = [];
  const unmatchedFacilities = [];

  const blocks = document.querySelectorAll('div.result-content');
  for (const block of blocks) {
    const nameEl = block.querySelector('h2 span');
    if (!nameEl) continue;

    const facilityName = nameEl.textContent.trim();
    allNames.push(facilityName);

    // --- Matching cascade ---
    // 1. Exact alias lookup
    let matched = aliasMap[facilityName] || null;
    let matchSource = matched ? 'alias' : null;

    // 2. Substring includes() fallback
    if (!matched) {
      matched = trackedFields.find((f) =>
        facilityName.toLowerCase().includes(f.toLowerCase())
      ) || null;
      if (matched) {
        matchSource = 'includes';
        newAliases.push({ trackedName: matched, webtracName: facilityName });
      }
    }

    // 3. Fuzzy token matching (discovery mode or always for new fields)
    if (!matched && discover) {
      let bestScore = 0;
      let bestField = null;
      for (const f of trackedFields) {
        const score = _fuzzyScore(f, facilityName);
        if (score > bestScore) {
          bestScore = score;
          bestField = f;
        }
      }
      if (bestScore >= 0.8 && bestField) {
        matched = bestField;
        matchSource = 'fuzzy';
        newAliases.push({ trackedName: bestField, webtracName: facilityName });
      } else {
        unmatchedFacilities.push({ facilityName, bestCandidate: bestField, score: bestScore });
      }
    }

    if (!matched) continue;

    const mapLink = block.querySelector('.search-more a[href*="maps.google.com"]');
    if (mapLink) {
      locations.push({ fieldName: matched, mapUrl: mapLink.href });
    }

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

  return { results, allNames, locations, newAliases, unmatchedFacilities };
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayEastern() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function toIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Generate an array of ISO date strings for the daily cron range (+15 to +maxDaysOut). */
export function getDailyDateRange(maxDaysOut = 40) {
  const today = todayEastern();
  const dates = [];
  for (let offset = MIN_DAYS_OUT; offset <= maxDaysOut; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    dates.push(toIso(d));
  }
  return dates;
}

/**
 * Expand a CLI date specification into an array of ISO date strings.
 * Accepts:
 *   "2026-04-15"                 → single date
 *   "2026-04-15" "2026-06-15"    → inclusive range (startDate, endDate)
 *
 * Throws if any date is fewer than MIN_DAYS_OUT days from today.
 */
export function parseDateRange(startStr, endStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
    throw new Error(`Invalid start date "${startStr}" — expected YYYY-MM-DD`);
  }

  const today = todayEastern();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startStr + 'T12:00:00');
  const diffDays = Math.round((start - today) / 86_400_000);
  if (diffDays < MIN_DAYS_OUT) {
    throw new Error(
      `Start date ${startStr} is only ${diffDays} days from today — minimum is ${MIN_DAYS_OUT}`
    );
  }

  if (!endStr) return [startStr];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(endStr)) {
    throw new Error(`Invalid end date "${endStr}" — expected YYYY-MM-DD`);
  }

  const end = new Date(endStr + 'T12:00:00');
  if (end < start) {
    throw new Error(`End date ${endStr} is before start date ${startStr}`);
  }

  const dates = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toIso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
