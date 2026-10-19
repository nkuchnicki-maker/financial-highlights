# Financial Highlights

A static dashboard of daily financial headlines from WSJ, Financial Times,
Bloomberg, Barron's and MarketWatch — headlines, summaries, and links back
to the original articles only. No paywalled article text is scraped or
reproduced; everything comes from each publisher's own public RSS
syndication, which is what RSS feeds are for.

## How it works

1. `scripts/fetch-feeds.js` fetches each publisher's RSS feed (Barron's has
   no working public feed anymore, so it falls back to a Google News feed
   restricted to barrons.com) and writes the result to
   `public/data/headlines.json`.
2. `public/index.html` + `app.js` is a plain static page that reads that
   JSON file and renders it.
3. A GitHub Actions workflow (`.github/workflows/update.yml`) runs the fetch
   script every day and commits the updated JSON.
4. Vercel (or Netlify) auto-deploys the `public/` folder on every push, so
   the live site picks up the new data automatically.

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
  `scripts/fetch-feeds.js` and the `sourceOrder` array in `public/app.js`.
- **Styling**: `public/style.css` — currently a simple dark dashboard grid.
