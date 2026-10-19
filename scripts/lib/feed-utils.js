// Shared RSS fetching/parsing helpers used by both the daily live fetch
// (fetch-feeds.js) and the past-date digest builder (build-digest.js).
import { XMLParser } from "fast-xml-parser";

export const FETCH_TIMEOUT_MS = 15000;
export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const googleNewsFallback = (domain) =>
  `https://news.google.com/rss/search?q=site:${domain}&hl=en-US&gl=US&ceid=US:en`;

export const googleNewsForDate = (domain, dateIso) => {
  const after = dateIso;
  const before = addDays(dateIso, 1);
  return `https://news.google.com/rss/search?q=site:${domain}+after:${after}+before:${before}&hl=en-US&gl=US&ceid=US:en`;
};

export function addDays(dateIso, days) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function fetchText(url) {
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

export function parseRss(xml, sourceName) {
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

// Google News titles are formatted "Headline - Publisher Name", and the
// publisher name it uses doesn't always match our source label (e.g.
// Bloomberg shows up as "Bloomberg.com"). Strip whichever alias applies.
const GOOGLE_NEWS_TITLE_ALIASES = {
  Bloomberg: ["Bloomberg", "Bloomberg.com"],
  WSJ: ["WSJ", "The Wall Street Journal"],
  "Financial Times": ["Financial Times", "FT.com"],
  "Barron's": ["Barron's", "Barrons.com"],
  MarketWatch: ["MarketWatch", "MarketWatch.com"],
};

export function cleanGoogleNewsTitle(title, sourceName) {
  const aliases = GOOGLE_NEWS_TITLE_ALIASES[sourceName] || [sourceName];
  let result = title;
  // Google News sometimes stacks both the site's own suffix and its
  // publisher-record name (e.g. "... - FT.com - Financial Times"), so
  // keep stripping until no more known alias suffix matches.
  let strippedSomething = true;
  while (strippedSomething) {
    strippedSomething = false;
    for (const alias of aliases) {
      const suffix = ` - ${alias}`;
      if (result.endsWith(suffix)) {
        result = result.slice(0, -suffix.length);
        strippedSomething = true;
      }
    }
  }
  return result;
}

export function textOf(value) {
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

export function decodeEntities(value) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, ent) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return HTML_ENTITIES[ent] ?? match;
  });
}

export function stripHtml(value) {
  return decodeEntities(value.replace(/<[^>]*>/g, "")).trim();
}

export function normalizeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function fetchFeedWithFallback(source, { limit = 10 } = {}) {
  for (const feedUrl of source.feeds) {
    try {
      const xml = await fetchText(feedUrl);
      const items = parseRss(xml, source.name);
      if (items.length > 0) {
        console.log(`[ok] ${source.name}: ${items.length} items from ${feedUrl}`);
        return items.slice(0, limit);
      }
      console.warn(`[empty] ${source.name}: 0 items from ${feedUrl}, trying next`);
    } catch (err) {
      console.warn(`[fail] ${source.name} <- ${feedUrl}: ${err.message}`);
    }
  }
  console.error(`[dropped] ${source.name}: all feeds failed`);
  return [];
}
