// Pulls public RSS headline feeds, writes public/data/headlines.json for
// the live "Today" view, and also archives + curates the same run under
// public/data/archive/<date>.json so the Digest tab builds its own history
// day by day without needing a separate backfill once this is running.
//
// We only ever keep headline / summary / link / date — never full article
// text — because WSJ, FT, Bloomberg and Barron's are paywalled. RSS feeds
// are the publishers' own public syndication of headlines, which is the
// legitimate way to aggregate them; scraping paywalled article bodies is not.
import { writeFile, mkdir } from "node:fs/promises";
import { fetchFeedWithFallback, googleNewsFallback } from "./lib/feed-utils.js";
import { curate } from "./lib/curate.js";
import { writeArchiveEntry } from "./lib/archive-store.js";

// Each source lists a primary feed and an optional fallback (used if the
// primary fails or returns zero items — publisher feed URLs change often).
const SOURCES = [
  {
    name: "WSJ",
    feeds: [
      "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",
      googleNewsFallback("wsj.com"),
    ],
  },
  {
    name: "Financial Times",
    feeds: ["https://www.ft.com/markets?format=rss", googleNewsFallback("ft.com")],
  },
  {
    name: "Bloomberg",
    feeds: [
      "https://www.bloomberg.com/feeds/markets/news.rss",
      googleNewsFallback("bloomberg.com"),
    ],
  },
  {
    name: "Barron's",
    // Barron's retired its official RSS feeds; Google News is the only
    // reliable public syndication source left for headlines + links.
    feeds: [googleNewsFallback("barrons.com")],
  },
  {
    name: "MarketWatch",
    feeds: [
      "https://feeds.marketwatch.com/marketwatch/topstories/",
      googleNewsFallback("marketwatch.com"),
    ],
  },
];

async function main() {
  const results = await Promise.all(SOURCES.map((s) => fetchFeedWithFallback(s)));
  const bySource = {};
  const allItems = [];
  for (const source of SOURCES) bySource[source.name] = [];
  for (const items of results) {
    if (items[0]) {
      bySource[items[0].source] = items;
      allItems.push(...items);
    }
  }

  const generatedAt = new Date().toISOString();
  const payload = { generatedAt, sources: bySource };

  await mkdir("public/data", { recursive: true });
  await writeFile("public/data/headlines.json", JSON.stringify(payload, null, 2));
  console.log("Wrote public/data/headlines.json");

  const today = generatedAt.slice(0, 10);
  const curated = curate(allItems);
  await writeArchiveEntry(today, { generatedAt, all: allItems, curated });
  console.log(`Archived ${allItems.length} items (${curated.length} curated) for ${today}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
