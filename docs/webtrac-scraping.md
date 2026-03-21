# WebTrac Scraping Reference

Everything we learned reverse-engineering the Raleigh Parks & Rec WebTrac site
for the field-availability bot. This doc is the single source of truth for
anyone maintaining `scripts/field-bot-local.mjs`.

---

## Target URL

```
https://ncraleighweb.myvscloud.com/webtrac/web/search.html?module=FR&display=detail
```

Module `FR` = Facility Rentals. `display=detail` shows per-slot availability.

---

## CSRF Token

Every request needs a `_csrf_token` query param. It is **session-specific**.

Where to find it:

| Method | Selector / Pattern |
|---|---|
| URL query string | After the initial page loads, the browser is redirected to a URL containing `_csrf_token=VALUE` |
| Hidden input | `input[name="_csrf_token"]` |
| Link hrefs | Any `<a href="...&_csrf_token=VALUE...">` on the page |

In Puppeteer, the easiest approach is to read it from the page URL after
`waitUntil: 'networkidle2'`:

```js
const csrfToken = new URL(page.url()).searchParams.get('_csrf_token');
```

---

## Category Filter (Critical)

The search form has a **multi-select** dropdown for Category:

```html
<select name="category" multiple class="combobox ...">
  <option value="Athletic Field">Athletic Field</option>
  <option value="Gymnasium">Gymnasium</option>
  <option value="Multipurpose Room">Multipurpose Room</option>
  <!-- ... 14 total categories ... -->
</select>
```

**You MUST filter by `category=Athletic Field`**, otherwise results include
classrooms, gyms, kitchens, shelters, etc. Without this filter the first 10
results (page 1) are all non-baseball facilities starting with "Abbotts Creek".

The `<select>` is hidden (`display: none`) and replaced by a Vue combobox. In
Puppeteer, set the value directly via `page.select()` or `page.evaluate()`:

```js
await page.evaluate(() => {
  const sel = document.querySelector('select[name="category"]');
  // Deselect all, then select Athletic Field
  for (const opt of sel.options) opt.selected = (opt.value === 'Athletic Field');
  sel.dispatchEvent(new Event('change', { bubbles: true }));
});
```

Or include `category=Athletic+Field` in the search URL query string.

---

## Search Form Parameters

The form submits as a **GET** request. Required params:

| Param | Value | Notes |
|---|---|---|
| `Action` | `Start` | |
| `_csrf_token` | (from page) | Session-specific |
| `date` | `MM/DD/YYYY` | Target date |
| `begintime` | `07:00 am` | Earliest slot to show |
| `category` | `Athletic Field` | **Critical filter** |
| `display` | `Detail` | Shows per-slot view |
| `search` | `yes` | |
| `module` | `FR` | Facility Rentals |
| `blockstodisplay` | `23` | Number of 30-min blocks |
| `frwebsearch_buttonsearch` | `yes` | Tells server it's a search submit |

Other params (`keyword`, `frclass`, `type`, `subtype`, `frheadcount`,
`features1-8`, `primarycode`, `multiselectlist_value`, `SubAction`,
`keywordoption`) can be empty strings.

---

## Target Date Logic

We scrape **exactly 14 days from today** (Eastern time, `America/New_York`).

Why: Raleigh Parks blocks field availability once a date is within 14 calendar
days. Day 14 is the **last visible day** before it becomes "unbookable".
Example: if today is March 14, the target date is March 28.

JavaScript's `Date.setDate()` handles month/year rollovers automatically
(e.g. March 20 + 14 = April 3).

```js
const now = new Date();
const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
eastern.setDate(eastern.getDate() + 14);
// Format as MM/DD/YYYY for the form, YYYY-MM-DD for our DB
```

---

## Result HTML Structure

Each facility result is a `div.result-content` block:

```
div.result-content
├── div.header.result-header
│   └── div.result-header__info
│       └── h2 > span  →  "Baileywick 1 Ballfield MAX Base 70 ft"
│
└── table#frwebsearch_output_table
    └── tbody
        ├── tr
        │   ├── td  →  <span class="dateblock" data-tooltip="03/29/2026">
        │   ├── td  →  "Multipurpose Room - Large" (facility description)
        │   └── td  →  "$65.00/$65.00" (price)
        │
        └── tr
            └── td.cart-blocks (colspan=5)
                ├── <a class="...success...cart-button--state-block...">
                │       9:00 am - 9:30 am
                │   </a>
                ├── <a class="...success...cart-button--state-block...">
                │       9:30 am - 10:00 am
                │   </a>
                └── ...
```

### Facility Name

```
Selector: div.result-content h2 span
```

Site names are verbose: `"Baileywick 1 Ballfield MAX Base 70 ft"`. We match
using case-insensitive `includes()` against our short tracked names like
`"Baileywick 1"`.

### Time Slot Availability

**Available slots** are `<a>` tags with BOTH `cart-button--state-block` AND
`success` in their class list:

```html
<a class="button multi-select full-block success instant-overlay cart-button cart-button--state-block"
   href="..." data-tooltip="Create a Permit Request">
  9:00 am - 9:30 am
</a>
```

**Booked/unavailable slots** appear in one of two forms:

1. An `<a>` tag with `cart-button--state-block` but WITHOUT `success` (may have
   `disabled`, `notice`, or other classes instead)
2. A `<span>` pair: `<span>TIME</span><span>Unavailable</span>`

### Detection Logic (Puppeteer)

```js
// Inside page.evaluate():
const blocks = document.querySelectorAll('div.result-content');
for (const block of blocks) {
  const name = block.querySelector('h2 span')?.textContent?.trim();
  const slots = block.querySelectorAll('a.cart-button--state-block');
  for (const slot of slots) {
    const time = slot.textContent.trim();
    const available = slot.classList.contains('success');
    // { name, time, status: available ? 'Available' : 'Booked' }
  }
}
```

---

## Pagination

Results are **10 per page**, sorted alphabetically by facility name.

### Page 1 Athletic Fields (confirmed)

| # | Facility Name (on site) | Our Tracked Name |
|---|---|---|
| 1 | Baileywick 1 Ballfield MAX Base 70 ft | Baileywick 1 |
| 2 | Baileywick 2 Ballfield MAX Base 60 ft | Baileywick 2 |
| 3 | Biltmore 2 Ballfield MAX Base 80 ft | Biltmore Hills 2 |
| 4 | Biltmore 1 Ballfield MAX Base 60 ft | _(not tracked)_ |
| 5 | Brentwood Ballfield MAX Base 50 ft | _(not tracked)_ |
| 6 | Carolina Pines 1 Ballfield MAX Base 70 ft | Carolina Pines 1 |
| 7 | Carolina Pines 2 Ballfield MAX Base 70 ft | Carolina Pines 2 |
| 8 | Carolina Pines 3 Ballfield MAX Base 70 ft | _(not tracked)_ |
| 9 | Cedar Hills Ballfield MAX Base 90 ft | Cedar Hills |
| 10 | Honeycutt Ballfield MAX Base 90 ft | Honeycutt |

### Page 2+ (not yet confirmed — discovery mode will map these)

Jaycee 1&2, Lake Lynn, Laurel Hills 1&2, Lions 1-4, Marsh Creek,
Millbrook 1&2, Oakwood 1, Optimist 2, Pullen 1&2, Sanderford 1, Worthdale 1.

### How Pagination Works

The URL `page=N` parameter **does NOT work** on its own (the server ignores it
and returns page 1 every time). Pagination requires **real browser interaction**
-- clicking page buttons rendered by client-side JavaScript.

Pagination HTML structure:

```html
<ul class="paging">
  <li class="paging__listitem">
    <button class="button paging__button primary"
            data-click-set-name="page" data-click-set-value="1">1</button>
  </li>
  <li class="paging__listitem">
    <button class="button paging__button"
            data-click-set-name="page" data-click-set-value="2">2</button>
  </li>
  <!-- ... page 3, 4 ... -->
  <li class="paging__listitem">
    <button class="button paging__button paging__lastpage"
            data-click-set-name="page" data-click-set-value="4">Go To Last Page</button>
  </li>
</ul>
```

Key selectors:
- Container: `ul.paging`
- Page buttons: `button.paging__button[data-click-set-value="N"]`
- Current page: has additional class `primary`
- Last page shortcut: has additional class `paging__lastpage`
- **4 pages total** for Athletic Fields (confirmed March 2026)

After clicking a page button, wait for `networkidle` + a short delay before
parsing, as the page content updates via AJAX.

---

## Cloudflare Bot Protection

The WebTrac site uses **Cloudflare Bot Fight Mode**. Key findings:

- **Datacenter IPs are blocked**: Cloudflare Workers (Browser Rendering API),
  GitHub Actions, and similar cloud platforms all get the "Sorry, you have been
  blocked" page.
- **Residential IPs work**: A Mac Mini on a home network bypasses the protection
  naturally -- no stealth plugins needed.
- **ScrapingBee works but costs credits**: Premium residential proxies bypass the
  block, at ~10 credits per JS-rendered request.

---

## Tracked Fields

Bobby's 25-field list (updated March 2026). The "Confirmed WebTrac Name" column
shows the actual facility name on the WebTrac site where we've verified the
mapping. Fields without a confirmed name rely on discovery mode (see below).

| Tracked Name | Type (from fields.md) | Confirmed WebTrac Name |
|---|---|---|
| Baileywick 1 | Baseball | Baileywick 1 Ballfield MAX Base 70 ft |
| Baileywick 2 | Baseball | Baileywick 2 Ballfield MAX Base 60 ft |
| Biltmore Hills 2 | Softball | Biltmore 2 Ballfield MAX Base 80 ft |
| Carolina Pines 1 | Softball | Carolina Pines 1 Ballfield MAX Base 70 ft |
| Carolina Pines 2 | Softball | Carolina Pines 2 Ballfield MAX Base 70 ft |
| Cedar Hills | Baseball/Softball | Cedar Hills Ballfield MAX Base 90 ft |
| Honeycutt | Baseball/Softball | Honeycutt Ballfield MAX Base 90 ft |
| Jaycee 1 | Softball | _(run discovery)_ |
| Jaycee 2 | Youth Softball | _(run discovery)_ |
| Lake Lynn | Youth Baseball | _(run discovery)_ |
| Laurel Hills 1 | Youth Baseball | _(run discovery)_ |
| Laurel Hills 2 | Youth Baseball | _(run discovery)_ |
| Lions 1 | Softball | _(run discovery)_ |
| Lions 2 | Softball | _(run discovery)_ |
| Lions 3 | Youth Baseball | _(run discovery)_ |
| Lions 4 | Baseball | _(run discovery)_ |
| Marsh Creek | Baseball | _(run discovery)_ |
| Millbrook 1 | Softball | _(run discovery)_ |
| Millbrook 2 | Softball | _(run discovery)_ |
| Oakwood 1 | Softball | _(run discovery)_ |
| Optimist 2 | Baseball | _(run discovery)_ |
| Pullen 1 | Softball | _(run discovery)_ |
| Pullen 2 | Youth Baseball | _(run discovery)_ |
| Sanderford 1 | Youth Baseball/Softball | _(run discovery)_ |
| Worthdale 1 | Softball | _(run discovery)_ |

---

## Field Name Discovery & Aliases

Bobby's short names (e.g. "Biltmore Hills 2") don't always match the verbose
WebTrac facility names (e.g. "Biltmore 2 Ballfield MAX Base 80 ft"). To handle
this, the scraper uses a `dim_field_aliases` table that maps WebTrac names to
our tracked names.

### How It Works

1. On startup, the scraper fetches all known aliases from `GET /api/fields/aliases`
2. For each facility on the page, matching uses a three-step cascade:
   - **Alias lookup** — exact match against `dim_field_aliases.webtrac_name`
   - **Substring match** — `facilityName.includes(trackedName)` (original logic)
   - **Fuzzy match** (discovery mode only) — tokenize both names, strip common
     suffixes like "Ballfield MAX Base XX ft", score by token overlap
3. When a new match is found via substring or fuzzy, it's saved as an alias

### Running Discovery Mode

```bash
# Local cron bot
DISCOVER=true ADMIN_PASSWORD=... node scripts/field-bot-local.mjs

# Or with --discover flag
ADMIN_PASSWORD=... node scripts/field-bot-local.mjs --discover

# Ad-hoc for a specific date
ADMIN_PASSWORD=... node scripts/field-bot-adhoc.mjs 2026-04-15 --discover
```

The first few runs with discovery mode enabled will populate `dim_field_aliases`
with confirmed mappings. After that, normal runs use the stored aliases for fast
exact matching. Check the scraper logs for:

- `Discovered N new alias(es)` — new mappings were found and saved
- `N facility name(s) could not be matched` — candidates for manual review
- `Tracked fields with NO slots found` — fields that may need alias correction

### API Endpoints for Aliases

- `GET /api/fields/aliases` — all rows from `dim_field_aliases` (public)
- `POST /api/fields/aliases` — upsert aliases (admin-only), body:
  ```json
  { "aliases": [{ "trackedName": "Biltmore Hills 2", "webtracName": "Biltmore 2 Ballfield MAX Base 80 ft", "confirmed": 1 }] }
  ```

### Database Table

```sql
CREATE TABLE dim_field_aliases (
  tracked_name TEXT NOT NULL,
  webtrac_name TEXT NOT NULL,
  confirmed INTEGER NOT NULL DEFAULT 0,  -- 0 = auto-discovered, 1 = manually verified
  PRIMARY KEY (tracked_name, webtrac_name)
);
```

---

## API Endpoints (Our Worker)

The local script authenticates and pushes results to the Cloudflare Worker:

1. **Login**: `POST /api/auth/login` with `{ password, role: "admin" }` → returns `{ token }`
2. **Import**: `POST /api/fields/import` with `Authorization: Bearer TOKEN` and body:
   ```json
   {
     "targetDate": "2026-03-29",
     "durationMs": 12345,
     "log": ["[INFO] ...", "[WARN] ..."],
     "results": [
       { "fieldName": "Baileywick 1", "timeSlot": "9:00 am - 9:30 am", "status": "Available" }
     ]
   }
   ```
3. **View runs**: `GET /api/fields/scrape-runs?limit=20` (admin-only)

---

## Mac Mini Setup

The scraper runs as a scheduled `launchd` job on the Mac Mini (reachable at
`100.90.16.107` over Tailscale). The residential IP on the Mini bypasses
Cloudflare bot protection naturally.

See `scripts/com.brokenbats.fieldbot.plist` for the plist definition.

### Deploy to Mac Mini

```bash
# From MBP — sync the repo to the Mini over Tailscale
ssh sam@100.90.16.107
cd ~/Documents/programming_projects/broken-bats-csc
git pull
npm install   # installs puppeteer + chromium
```

### Install launchd Job

```bash
# Copy the plist
cp scripts/com.brokenbats.fieldbot.plist ~/Library/LaunchAgents/

# Load it (starts the daily schedule)
launchctl load ~/Library/LaunchAgents/com.brokenbats.fieldbot.plist

# Verify it's loaded
launchctl list | grep brokenbats

# To run immediately (for testing)
launchctl start com.brokenbats.fieldbot

# To unload
launchctl unload ~/Library/LaunchAgents/com.brokenbats.fieldbot.plist
```

### Environment Variables

Set these in your shell profile (`~/.zshrc`) or in the plist's
`EnvironmentVariables` dict:

| Variable | Required | Description |
|---|---|---|
| `ADMIN_PASSWORD` | Yes | Admin password for the Broken Bats API |
| `SITE_URL` | No | Defaults to `https://cscbrokenbats.org` |
| `HEADLESS` | No | Set to `false` to watch the browser (debugging) |

### Logs

stdout/stderr are written to `~/Library/Logs/field-bot.log`.

```bash
tail -f ~/Library/Logs/field-bot.log
```
