// Tags headlines as "macro" and/or "markets" relevant by keyword matching,
// so a newsletter aimed at students learning markets/macro can pull a
// curated subset instead of every headline a publisher put out that day
// (personal-finance advice columns, celebrity business stories, etc. get
// filtered out).

const MACRO_KEYWORDS = [
  "federal reserve",
  "fed chair",
  "fomc",
  "interest rate",
  "rate cut",
  "rate hike",
  "rate decision",
  "rate pause",
  "inflation",
  "cpi",
  "ppi",
  "pce",
  "gdp",
  "gross domestic product",
  "jobs report",
  "payrolls",
  "unemployment",
  "jobless claims",
  "recession",
  "economic growth",
  "economists",
  "central bank",
  "treasury yield",
  "yield curve",
  "trade deficit",
  "tariff",
  "budget deficit",
  "debt ceiling",
  "stimulus",
  "monetary policy",
  "fiscal policy",
  "consumer spending",
  "retail sales",
  "housing starts",
  "manufacturing index",
  "pmi",
  "ecb",
  "bank of england",
  "bank of japan",
  "boj",
  "soft landing",
  "economy",
  "economic",
];

const MARKETS_KEYWORDS = [
  "s&p 500",
  "dow jones",
  "nasdaq",
  "stock market",
  "stocks rebound",
  "stocks tumble",
  "stocks fall",
  "stocks rise",
  "stocks slump",
  "equities",
  "bond market",
  "bonds",
  "treasuries",
  "ipo",
  "earnings",
  "sell-off",
  "selloff",
  "rally",
  "wall street",
  "volatility",
  "vix",
  "hedge fund",
  "commodities",
  "oil price",
  "crude oil",
  "gold",
  "copper",
  "futures",
  "options trading",
  "market cap",
  "shares",
  "bull market",
  "bear market",
  "stock market today",
  "markets",
  "market",
  "stock",
  "bond",
  "yield",
  "trader",
  "investor",
];

function countMatches(text, keywords) {
  const lower = text.toLowerCase();
  const matched = new Set();
  for (const kw of keywords) {
    if (lower.includes(kw)) matched.add(kw);
  }
  return matched;
}

export function tagHeadline(item) {
  const text = `${item.title} ${item.summary || ""}`;
  const macroMatches = countMatches(text, MACRO_KEYWORDS);
  const marketsMatches = countMatches(text, MARKETS_KEYWORDS);
  const tags = [];
  if (macroMatches.size > 0) tags.push("macro");
  if (marketsMatches.size > 0) tags.push("markets");
  return {
    ...item,
    tags,
    relevance: macroMatches.size + marketsMatches.size,
  };
}

// Tags every item, then returns only the markets/macro-relevant ones,
// most relevant and most recent first, capped per source so one prolific
// source doesn't crowd out the rest of the newsletter digest.
export function curate(items, { perSourceLimit = 6 } = {}) {
  const tagged = items.map(tagHeadline).filter((it) => it.relevance > 0);
  tagged.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return new Date(b.pubDate || 0) - new Date(a.pubDate || 0);
  });
  const perSourceCount = {};
  const curated = [];
  for (const item of tagged) {
    const count = perSourceCount[item.source] || 0;
    if (count >= perSourceLimit) continue;
    perSourceCount[item.source] = count + 1;
    curated.push(item);
  }
  return curated;
}
