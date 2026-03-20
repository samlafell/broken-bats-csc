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
| 3 | Biltmore 2 Ballfield MAX Base 80 ft | _(not tracked)_ |
| 4 | Biltmore 1 Ballfield MAX Base 60 ft | _(not tracked)_ |
| 5 | Brentwood Ballfield MAX Base 50 ft | _(not tracked)_ |
| 6 | Carolina Pines 1 Ballfield MAX Base 70 ft | _(not tracked)_ |
| 7 | Carolina Pines 2 Ballfield MAX Base 70 ft | _(not tracked)_ |
| 8 | Carolina Pines 3 Ballfield MAX Base 70 ft | _(not tracked)_ |
| 9 | Cedar Hills Ballfield MAX Base 90 ft | Cedar Hills |
| 10 | Honeycutt Ballfield MAX Base 90 ft | Honeycutt |

### Page 2+ (expected, not yet confirmed)

Green Road 1&2, Jaycee fields, Kentwood, Kiwanis, Lake Lynn, Laurel Hills 1&2,
Lions 1-4, Marsh Creek, etc.

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

These are the fields our team can use (from `fields.md`). The "Tracked Name"
column is what we use for `includes()` matching against the verbose site names.

| Tracked Name | Type (from fields.md) |
|---|---|
| Baileywick 1 | Baseball |
| Baileywick 2 | Baseball |
| Cedar Hills | Baseball/Softball |
| Green Road 1 | Baseball |
| Green Road 2 | Baseball |
| Honeycutt | Baseball/Softball |
| Kiwanis | Baseball |
| Lions 4 | Baseball |
| Marsh Creek | Baseball |
| Oakwood 2 | Baseball |
| Optimist 2 | Baseball |

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
