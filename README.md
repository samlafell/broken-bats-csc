# Broken Bats CSC

Full-stack website for the Broken Bats adult amateur baseball team in the Carolina Sandlot Collective.

**Stack:** React 19 + Vite (frontend) / Hono on Cloudflare Workers (API) / D1 SQLite (database)

## Local Development

**Prerequisites:** Node.js 18+, npm

```bash
npm install
npm run dev
```

This starts Vite with the Cloudflare Workers runtime, giving you HMR for the React SPA and a local D1 database.

### Setting Up the Local Database

On first run, create and seed the local D1 database:

```bash
npm run db:schema:local
npm run db:seed:local
```

## Deployment

### 1. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 2. Create the D1 Database

```bash
npx wrangler d1 create broken-bats-db
```

Copy the `database_id` from the output and paste it into `wrangler.jsonc`:

```jsonc
"database_id": "<YOUR_DATABASE_ID_HERE>"
```

### 3. Run Schema Migration & Seed

```bash
npm run db:schema
npm run db:seed
```

### 4. Set Secrets

Generate password hashes. For each password, get its SHA-256 hex digest and set it as a secret:

```bash
# Generate a hash (replace YOUR_PASSWORD with the actual password)
echo -n "YOUR_PASSWORD" | shasum -a 256 | cut -d ' ' -f 1

# Set the secrets
npx wrangler secret put PLAYER_PASSWORD_HASH
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put JWT_SECRET
```

- `PLAYER_PASSWORD_HASH` — SHA-256 hash of the team Clubhouse password
- `ADMIN_PASSWORD_HASH` — SHA-256 hash of the Manager's Office password
- `JWT_SECRET` — any random string used to sign auth tokens (e.g. `openssl rand -hex 32`)

### 5. Deploy

```bash
npm run deploy
```

Your site will be live at `https://broken-bats-csc.<your-subdomain>.workers.dev`.

### 6. Custom Domain

1. Purchase your domain and add it to your Cloudflare account
2. In the Cloudflare dashboard: **Workers & Pages** > **broken-bats-csc** > **Settings** > **Domains & Routes** > **Add Custom Domain**
3. Cloudflare automatically provisions DNS records and SSL

## Project Structure

```
src/                    React SPA
  components/           Shared UI (Navbar, Ticker, LoginGate, Layout)
  pages/                Route pages (Home, Clubhouse, Admin)
  hooks/                React hooks (useAuth)
  lib/                  Utilities (api client)
worker/                 Cloudflare Worker (Hono API)
  index.ts              Entry point — mounts all routes
  routes/               API route handlers
  middleware/            Auth middleware
  db/                   SQL schema and seed files
wrangler.jsonc          Cloudflare Worker + D1 configuration
vite.config.ts          Vite + Cloudflare plugin config
```

## API Routes

| Endpoint | Methods | Auth |
|---|---|---|
| `/api/ticker` | GET | Public |
| `/api/roster` | GET | Public |
| `/api/roster` | POST, PUT, DELETE | Admin |
| `/api/schedule` | GET | Public |
| `/api/schedule` | POST, PUT, DELETE | Admin |
| `/api/media` | GET | Public |
| `/api/rsvp` | GET, POST | Player |
| `/api/posts` | GET, POST | Player |
| `/api/dues` | GET | Player |
| `/api/dues` | PUT | Admin |
| `/api/fields` | GET | Public |
| `/api/fields` | POST, PUT | Admin |
| `/api/auth/login` | POST | Public |
| `/api/auth/verify` | GET | Public |
