# Financial Highlights

A static dashboard of daily financial headlines from WSJ, Financial Times,
Bloomberg, Barron's and MarketWatch — headlines, summaries, and links back
to the original articles only. No paywalled article text is scraped or
reproduced; everything comes from each publisher's own public RSS
syndication, which is what RSS feeds are for.

The site has two tabs:

- **Today** — the live feed from each publisher, refreshed daily.
- **Markets & Macro Digest** — a curated, per-day archive filtered down to
  headlines actually relevant to markets/macro (Fed policy, rates,
  inflation, jobs data, stocks, bonds, earnings, etc.), meant as a starting
  point for a student newsletter rather than a full news firehose. It
  defaults to the most recent Friday in the archive.

## How it works

1. `scripts/fetch-feeds.js` fetches each publisher's RSS feed (Barron's has
   no working public feed anymore, so it falls back to a Google News feed
   restricted to barrons.com), writes the live result to
   `public/data/headlines.json`, and **also** archives + curates that same
   run under `public/data/archive/<today's date>.json` — so every day this
   runs, that day becomes available in the Digest tab automatically.
2. `scripts/lib/curate.js` tags each headline `macro` and/or `markets` by
   keyword matching (Fed/CPI/GDP/jobs data → macro; S&P/bonds/earnings/
   yields → markets) and keeps only tagged items, capped per source, for
   the curated digest.
3. `public/index.html` + `app.js` is a plain static page with two tabs that
   read `headlines.json` (Today) and `archive/<date>.json` (Digest).
4. A GitHub Actions workflow (`.github/workflows/update.yml`) runs the fetch
   script every day and commits both the live file and that day's archive
   entry.
5. Vercel (or Netlify) auto-deploys the `public/` folder on every push, so
   the live site picks up the new data automatically.

### Backfilling a past date (e.g. "last Friday" before the pipeline existed)

RSS feeds only expose the latest ~10–25 items, not history, so a date that
predates this pipeline running daily can't be recovered from the live
feeds. Instead, `scripts/build-digest.js` queries Google News' date-
restricted search per publisher domain to reconstruct that day:

```bash
npm run digest                # defaults to the most recent Friday
npm run digest -- 2026-10-16  # or a specific date (YYYY-MM-DD)
```

This is a one-time backfill tool — once the daily workflow has run on a
given day, that day is already archived and this isn't needed for it.
Google News' date filtering is approximate (it's a best-effort search, not
an official archive API), so spot-check backfilled digests before using
them.

## One-time setup

### 1. Install dependencies and test the fetch locally

```bash
npm install
npm run fetch
```

This writes `public/data/headlines.json`. Open `public/index.html` directly
in a browser (or run a local static server, e.g. `npx serve public`) to
check it renders.

### 2. Push this to GitHub

```bash
git init
git add .
git commit -m "Initial financial highlights dashboard"
```

Create a new empty repo on GitHub (github.com/new), then:

```bash
git remote add origin https://github.com/<you>/financial-highlights.git
git branch -M main
git push -u origin main
```

The workflow runs daily at 11:00 UTC and also has a manual trigger (go to
the **Actions** tab → "Update financial headlines" → **Run workflow** to
test it immediately instead of waiting for the schedule).

### 3. Deploy to Vercel (free)

1. Go to [vercel.com](https://vercel.com), sign in with GitHub.
2. "Add New Project" → import your `financial-highlights` repo.
3. Vercel will detect `vercel.json` (output directory `public`) — no build
   command needed. Click **Deploy**.
4. Every push to `main` (including the daily commit from GitHub Actions)
   triggers an automatic redeploy, so the live site updates every day
   without you touching anything.

You'll get a free `*.vercel.app` URL immediately; you can attach a custom
domain later from the Vercel project settings if you own one.

## Notes on sourcing / legitimacy

- **WSJ, Bloomberg**: official public RSS feeds (`feeds.content.dowjones.io`,
  `bloomberg.com/feeds`) — syndicated by the publisher intentionally.
- **Financial Times, MarketWatch**: official RSS feeds that can be blocked
  for some requesters; the script falls back to a Google News feed
  restricted to that domain if the official one fails.
- **Barron's**: no working official RSS feed exists anymore, so it always
  uses the Google News fallback.
- The site only ever stores/displays **headline, short summary, publish
  date, and a link to the original article** — never full article text.
  That keeps this within each publisher's terms and avoids paywall
  circumvention. If you want full-article summaries, you'd need a paid data
  license from the relevant publisher.

## Customizing

- **Change update frequency**: edit the `cron` line in
  `.github/workflows/update.yml` ([crontab.guru](https://crontab.guru) helps
  with the syntax).
- **Add/remove sources**: edit the `SOURCES` array in
  `scripts/fetch-feeds.js`, the `DOMAINS` map in `scripts/build-digest.js`,
  and the `SOURCE_ORDER` array in `public/app.js`.
- **Tune what counts as markets/macro**: edit the `MACRO_KEYWORDS` /
  `MARKETS_KEYWORDS` lists in `scripts/lib/curate.js`.
- **Styling**: `public/style.css` — currently a simple dark dashboard grid.
