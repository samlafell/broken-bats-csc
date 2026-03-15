#!/usr/bin/env node

/**
 * Broken Bats Discord Bot — Check field availability via /field-check.
 *
 * Runs as a persistent process on the Mac Mini. If data for the requested
 * date is already in the API it returns immediately; otherwise it kicks off
 * an ad-hoc Puppeteer scrape and replies when done.
 *
 * Env vars:
 *   DISCORD_BOT_TOKEN  (required)
 *   DISCORD_GUILD_ID   (required) — server to register slash commands in
 *   ADMIN_PASSWORD     (required) — for the ad-hoc scraper's API auth
 *   SITE_URL           (optional) — defaults to https://cscbrokenbats.org
 */

import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';

import { scrapeForDate } from './field-bot-adhoc.mjs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const SITE_URL = process.env.SITE_URL || 'https://cscbrokenbats.org';

if (!TOKEN) { console.error('DISCORD_BOT_TOKEN is required'); process.exit(1); }
if (!GUILD_ID) { console.error('DISCORD_GUILD_ID is required'); process.exit(1); }

// ---------------------------------------------------------------------------
// Slash command definition
// ---------------------------------------------------------------------------

const fieldCheckCommand = new SlashCommandBuilder()
  .setName('field-check')
  .setDescription('Check baseball field availability for a specific date')
  .addStringOption((opt) =>
    opt
      .setName('date')
      .setDescription('Date to check (YYYY-MM-DD)')
      .setRequired(true)
  );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateHuman(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function isValidDate(str) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(str + 'T12:00:00');
  return !isNaN(d.getTime());
}

function isFutureDate(isoDate) {
  const now = new Date();
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const today = `${eastern.getFullYear()}-${String(eastern.getMonth() + 1).padStart(2, '0')}-${String(eastern.getDate()).padStart(2, '0')}`;
  return isoDate >= today;
}

/**
 * Build a Discord embed from an array of field slot objects.
 * @param {Array<{name:string, time_slot?:string, timeSlot?:string, status:string}>} slots
 * @param {string} isoDate
 * @param {object} opts
 * @param {boolean} [opts.freshScrape] - true if data was just scraped
 */
function buildEmbed(slots, isoDate, opts = {}) {
  const humanDate = formatDateHuman(isoDate);
  const availCount = slots.filter((s) => s.status === 'Available').length;
  const totalCount = slots.length;

  const color = availCount > 0 ? 0x22c55e : 0xef4444; // green / red

  const embed = new EmbedBuilder()
    .setTitle(`Field Availability — ${humanDate}`)
    .setColor(color);

  if (totalCount === 0) {
    embed.setDescription('No field data found for this date.');
    return embed;
  }

  embed.setDescription(
    `**${availCount}** of **${totalCount}** slots available`
  );

  // Group by field name
  const byField = new Map();
  for (const s of slots) {
    const name = s.name ?? s.fieldName;
    if (!byField.has(name)) byField.set(name, []);
    byField.get(name).push(s);
  }

  for (const [fieldName, fieldSlots] of byField) {
    const lines = fieldSlots.map((s) => {
      const time = s.time_slot ?? s.timeSlot;
      const icon = s.status === 'Available' ? '🟢' : '🔴';
      return `${icon} ${time}`;
    });

    // Discord embed field values max out at 1024 chars
    let value = lines.join('\n');
    if (value.length > 1024) {
      value = value.slice(0, 1020) + '\n...';
    }
    embed.addFields({ name: fieldName, value, inline: true });
  }

  const footer = opts.freshScrape
    ? 'Freshly scraped just now'
    : 'From cached data';
  embed.setFooter({ text: footer });
  embed.setTimestamp();

  return embed;
}

// ---------------------------------------------------------------------------
// Client setup
// ---------------------------------------------------------------------------

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Track in-flight scrapes so we don't double-scrape the same date
const activeScrapes = new Map();

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'field-check') return;

  const dateStr = interaction.options.getString('date', true).trim();

  if (!isValidDate(dateStr)) {
    await interaction.reply({
      content: `**Invalid date** — please use YYYY-MM-DD format (e.g. \`2026-04-15\`).`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!isFutureDate(dateStr)) {
    await interaction.reply({
      content: `That date is in the past. Field availability is only useful for upcoming dates.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check API for existing data
  try {
    const res = await fetch(`${SITE_URL}/api/fields?date=${dateStr}`);
    const existing = await res.json();

    if (Array.isArray(existing) && existing.length > 0) {
      const embed = buildEmbed(existing, dateStr, { freshScrape: false });
      await interaction.reply({ embeds: [embed] });
      return;
    }
  } catch (err) {
    console.error(`[discord-bot] API check failed: ${err.message}`);
  }

  // No data — need to scrape. Defer the reply (scraping takes 30-60s).
  await interaction.deferReply();

  // Coalesce concurrent requests for the same date
  if (activeScrapes.has(dateStr)) {
    try {
      const { results } = await activeScrapes.get(dateStr);
      const embed = buildEmbed(results, dateStr, { freshScrape: true });
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({
        content: `Scrape for ${dateStr} failed: ${err.message}`,
      });
    }
    return;
  }

  const scrapePromise = scrapeForDate(dateStr);
  activeScrapes.set(dateStr, scrapePromise);

  try {
    const { results } = await scrapePromise;
    const embed = buildEmbed(results, dateStr, { freshScrape: true });
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error(`[discord-bot] Scrape failed for ${dateStr}: ${err.message}`);
    await interaction.editReply({
      content: `Failed to scrape field data for ${dateStr}: ${err.message}`,
    });
  } finally {
    activeScrapes.delete(dateStr);
  }
});

// ---------------------------------------------------------------------------
// Register slash commands and go online
// ---------------------------------------------------------------------------

client.once(Events.ClientReady, async (c) => {
  console.log(`[discord-bot] Logged in as ${c.user.tag}`);

  const rest = new REST().setToken(TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(c.user.id, GUILD_ID),
      { body: [fieldCheckCommand.toJSON()] },
    );
    console.log('[discord-bot] Slash commands registered');
  } catch (err) {
    console.error('[discord-bot] Failed to register commands:', err);
  }
});

client.login(TOKEN);
