---
name: Deploy Discord Bot
overview: The Discord bot code is fully written and ready to go. The remaining work is all deployment/configuration -- getting real secrets into the plist, installing the launchd agent, and doing a one-time test to confirm it's online in the Discord server.
todos:
  - id: gather-secrets
    content: "Gather the 3 required secrets: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, ADMIN_PASSWORD"
    status: pending
  - id: update-plist
    content: Update the launchd plist with real secret values (keep secrets out of git)
    status: pending
  - id: install-agent
    content: Copy plist to ~/Library/LaunchAgents/ and load it with launchctl
    status: pending
  - id: verify-bot
    content: Check logs and test /field-check in the Discord server
    status: pending
  - id: invite-if-needed
    content: If bot not yet invited, use OAuth2 URL to add it to server and assign Thomas's role
    status: pending
isProject: false
---

# Deploy the Broken Bats Discord Bot

## Current State

The bot code is **complete** in [scripts/discord-bot.mjs](scripts/discord-bot.mjs). It registers a `/field-check` slash command that lets users type `/field-check date:2026-04-15` and get a rich embed showing field availability (green/red per time slot, grouped by field name). If cached data exists in the API it responds instantly; if not, it live-scrapes WebTrac via Puppeteer in ~30-60 seconds.

**Nothing has been deployed yet** -- no `.env` file, no launchd agent installed, no log file, and the bot process has never run on this Mac.

## What Thomas Has Done (Discord Server Side)

Thomas created a **role** in the Discord server with the permissions the bot needs. That's the server-side piece. The remaining work is all on **your machine** (the Mac Mini that will run the bot).

## Steps to Get It Running

### Step 1: Gather 3 secrets

You need three values that go into the launchd plist:

- `**DISCORD_BOT_TOKEN`** -- from the [Discord Developer Portal](https://discord.com/developers/applications). Open your bot application, go to the **Bot** tab, and copy (or reset) the token.
- `**DISCORD_GUILD_ID`** -- right-click the Broken Bats server name in Discord (with Developer Mode enabled in Settings > Advanced), then "Copy Server ID".
- `**ADMIN_PASSWORD`** -- the **plaintext** admin password for `cscbrokenbats.org` (the one whose SHA-256 hash is stored as `ADMIN_PASSWORD_HASH` in Cloudflare). This is needed when the bot triggers a live scrape and needs to POST imported data back to the API.

### Step 2: Update the plist template with real values

In [scripts/com.brokenbats.discordbot.plist](scripts/com.brokenbats.discordbot.plist), replace the three placeholder strings:

- `YOUR_DISCORD_BOT_TOKEN` --> the real token
- `YOUR_DISCORD_GUILD_ID` --> the real server ID
- `admin123` --> the real admin password

The Node path and project path in the plist already match this machine, so those are fine.

**Important:** Do NOT commit the plist with real secrets. We should add it to `.gitignore` or keep a separate `.plist.example` and maintain the real one only in `~/Library/LaunchAgents/`.

### Step 3: Install and start the launchd agent

```bash
cp scripts/com.brokenbats.discordbot.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.brokenbats.discordbot.plist
```

The bot will start immediately (`RunAtLoad`) and auto-restart on crash (`KeepAlive`). Logs go to `~/Library/Logs/discord-bot.log`.

### Step 4: Verify it's working

```bash
tail -f ~/Library/Logs/discord-bot.log
```

You should see: `[discord-bot] Logged in as <BotName>#1234` followed by `[discord-bot] Slash commands registered`.

Then go to the Discord server and type `/field-check date:2026-04-01` (or any future date). You should get a rich embed response.

### Step 5 (if not already done): Invite the bot to the server

If the bot hasn't been invited yet (Thomas may have already done this when creating the role):

1. Go to [Discord Developer Portal](https://discord.com/developers/applications) > your app > **OAuth2 > URL Generator**
2. Scopes: `bot`, `applications.commands`
3. Permissions: **Send Messages**, **Embed Links**
4. Copy the generated URL, open it, and select the Broken Bats server
5. Assign the role Thomas created to the bot

## What Does NOT Need Code Changes

- The slash command, embed formatting, scrape logic, and API integration are all implemented
- The launchd plist template is ready (just needs real secrets)
- `discord.js` is already in `package.json` dependencies

## Pre-Flight Checklist

Before starting, confirm:

1. Have you created a Discord Application in the Developer Portal? (If not, follow steps 1-4 in [.env.example](.env.example))
2. Has the bot already been invited to the server via the OAuth2 URL? (Thomas may have done this)
3. Do you know the plaintext admin password for the site?

