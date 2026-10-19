// Pulls public RSS headline feeds and writes public/data/headlines.json
// for the static site to render.
//
// We only ever keep headline / summary / link / date — never full article
// text — because WSJ, FT, Bloomberg and Barron's are paywalled. RSS feeds
// are the publishers' own public syndication of headlines, which is the
// legitimate way to aggregate them; scraping paywalled article bodies is not.
import { XMLParser } from "fast-xml-parser";
import { writeFile, mkdir } from "node:fs/promises";

const FETCH_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const googleNewsFallback = (domain) =>
  `https://news.google.com/rss/search?q=site:${domain}&hl=en-US&gl=US&ceid=US:en`;

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

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseRss(xml, sourceName) {
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item;
  if (!items) return [];
  const list = Array.isArray(items) ? items : [items];
  return list
    .map((item) => {
      const title = cleanGoogleNewsTitle(stripHtml(textOf(item.title)), sourceName);
      const rawSummary = stripHtml(textOf(item.description)).slice(0, 280);
      // Google News' RSS description is just the title again (plus the
      // source name) — drop it rather than show a duplicate line.
      const summary = rawSummary === "" || rawSummary.startsWith(title) ? "" : rawSummary;
      return {
        source: sourceName,
        title,
        link: textOf(item.link),
        summary,
        pubDate: normalizeDate(item.pubDate),
      };
    })
    .filter((it) => it.title && it.link);
}

// Google News titles are formatted "Headline - Publisher Name"; strip that
// trailing attribution since we already show it as the column header.
function cleanGoogleNewsTitle(title, sourceName) {
  const suffix = ` - ${sourceName}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

function textOf(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && "#text" in value) return String(value["#text"]);
  return String(value);
}

const HTML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, ent) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return HTML_ENTITIES[ent] ?? match;
  });
}

function stripHtml(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, "")).trim();
}

function normalizeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchSource(source) {
  for (const feedUrl of source.feeds) {
    try {
      const xml = await fetchText(feedUrl);
      const items = parseRss(xml, source.name);
      if (items.length > 0) {
        console.log(`[ok] ${source.name}: ${items.length} items from ${feedUrl}`);
        return items.slice(0, 10);
      }
      console.warn(`[empty] ${source.name}: 0 items from ${feedUrl}, trying next`);
    } catch (err) {
      console.warn(`[fail] ${source.name} <- ${feedUrl}: ${err.message}`);
    }
  }
  console.error(`[dropped] ${source.name}: all feeds failed`);
  return [];
}

async function main() {
  const results = await Promise.all(SOURCES.map(fetchSource));
  const bySource = {};
  for (const source of SOURCES) bySource[source.name] = [];
  for (const items of results) if (items[0]) bySource[items[0].source] = items;

  const payload = {
    generatedAt: new Date().toISOString(),
    sources: bySource,
  };

  await mkdir("public/data", { recursive: true });
  await writeFile("public/data/headlines.json", JSON.stringify(payload, null, 2));
  console.log("Wrote public/data/headlines.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
