// Backfills a specific past date (e.g. "last Friday") for the Digest tab
// by querying Google News' date-restricted search per publisher domain.
// Only needed for dates before this pipeline started running daily —
// once fetch-feeds.js has run on a given day, that day is already archived.
//
// Usage:
//   node scripts/build-digest.js            # defaults to the most recent Friday
//   node scripts/build-digest.js 2026-10-16  # a specific date (YYYY-MM-DD)
import { fetchText, parseRss, googleNewsForDate, addDays } from "./lib/feed-utils.js";
import { curate } from "./lib/curate.js";
import { writeArchiveEntry } from "./lib/archive-store.js";

const DOMAINS = {
  WSJ: "wsj.com",
  "Financial Times": "ft.com",
  Bloomberg: "bloomberg.com",
  "Barron's": "barrons.com",
  MarketWatch: "marketwatch.com",
};

function mostRecentFriday(excludeToday = true) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  if (excludeToday) d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() !== 5) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

function isWithinTargetDate(pubDate, targetDate) {
  if (!pubDate) return false;
  // Generous window: the target's US trading day, allowing for the UTC/ET
  // offset (evening ET stories land after midnight UTC the next day).
  const start = new Date(`${targetDate}T00:00:00Z`).getTime();
  const end = new Date(`${addDays(targetDate, 1)}T12:00:00Z`).getTime();
  const t = new Date(pubDate).getTime();
  return t >= start && t <= end;
}

async function fetchForDate(sourceName, domain, date) {
  const url = googleNewsForDate(domain, date);
  try {
    const xml = await fetchText(url);
    const items = parseRss(xml, sourceName).filter((it) => isWithinTargetDate(it.pubDate, date));
    console.log(`[ok] ${sourceName}: ${items.length} items for ${date}`);
    return items;
  } catch (err) {
    console.warn(`[fail] ${sourceName} for ${date}: ${err.message}`);
    return [];
  }
}

async function main() {
  const date = process.argv[2] || mostRecentFriday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Expected date as YYYY-MM-DD, got "${date}"`);
  }
  console.log(`Building digest for ${date}...`);

  const results = await Promise.all(
    Object.entries(DOMAINS).map(([sourceName, domain]) => fetchForDate(sourceName, domain, date))
  );
  const allItems = results.flat();
  const curated = curate(allItems);

  await writeArchiveEntry(date, { generatedAt: new Date().toISOString(), all: allItems, curated });
  console.log(`Archived ${allItems.length} items (${curated.length} curated) for ${date}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
