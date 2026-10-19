const SOURCE_ORDER = ["WSJ", "Financial Times", "Bloomberg", "Barron's", "MarketWatch"];

initTabs();
loadToday();
loadDigestIndex();

function initTabs() {
  const tabToday = document.getElementById("tab-today");
  const tabDigest = document.getElementById("tab-digest");
  const viewToday = document.getElementById("view-today");
  const viewDigest = document.getElementById("view-digest");

  tabToday.addEventListener("click", () => {
    tabToday.classList.add("active");
    tabToday.setAttribute("aria-selected", "true");
    tabDigest.classList.remove("active");
    tabDigest.setAttribute("aria-selected", "false");
    viewToday.hidden = false;
    viewDigest.hidden = true;
  });

  tabDigest.addEventListener("click", () => {
    tabDigest.classList.add("active");
    tabDigest.setAttribute("aria-selected", "true");
    tabToday.classList.remove("active");
    tabToday.setAttribute("aria-selected", "false");
    viewDigest.hidden = false;
    viewToday.hidden = true;
  });
}

async function loadToday() {
  const board = document.getElementById("board");
  const updated = document.getElementById("updated");
  try {
    const res = await fetch("data/headlines.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderToday(data, board, updated);
  } catch (err) {
    updated.textContent = "Could not load headlines.";
    board.innerHTML = `<p class="empty-note">Error loading data/headlines.json: ${escapeHtml(err.message)}</p>`;
  }
}

function renderToday(data, board, updated) {
  const generated = new Date(data.generatedAt);
  updated.textContent = `Last updated ${formatDateTime(generated)}`;

  board.innerHTML = "";
  for (const name of SOURCE_ORDER) {
    const items = data.sources?.[name] || [];
    const card = document.createElement("section");
    card.className = "source-card";

    const heading = document.createElement("h2");
    heading.textContent = name;
    card.appendChild(heading);

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "No headlines available right now.";
      card.appendChild(empty);
    } else {
      const list = document.createElement("ul");
      for (const item of items) list.appendChild(renderItem(item));
      card.appendChild(list);
    }

    board.appendChild(card);
  }
}

async function loadDigestIndex() {
  const select = document.getElementById("digest-date");
  try {
    const res = await fetch("data/archive/index.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const index = await res.json();
    const dates = index.dates || [];
    if (dates.length === 0) {
      select.innerHTML = `<option>No archived dates yet</option>`;
      return;
    }

    select.innerHTML = "";
    for (const entry of dates) {
      const opt = document.createElement("option");
      opt.value = entry.date;
      opt.textContent = formatDateLabel(entry.date);
      select.appendChild(opt);
    }

    const defaultDate = pickDefaultDate(dates.map((d) => d.date));
    select.value = defaultDate;
    select.addEventListener("change", () => loadDigest(select.value));

    loadDigest(select.value);
  } catch (err) {
    select.innerHTML = `<option>Error loading archive</option>`;
    document.getElementById("digest-board").innerHTML =
      `<p class="empty-note">Error loading data/archive/index.json: ${escapeHtml(err.message)}</p>`;
  }
}

// Prefer the most recent Friday if it's in the archive (newsletters usually
// cover the prior trading week's close); otherwise fall back to the most
// recent archived date.
function pickDefaultDate(dates) {
  const friday = dates.find((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 5);
  return friday || dates[0];
}

async function loadDigest(date) {
  const board = document.getElementById("digest-board");
  board.innerHTML = `<p class="empty-note">Loading…</p>`;
  try {
    const res = await fetch(`data/archive/${date}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderDigest(data, board);
  } catch (err) {
    board.innerHTML = `<p class="empty-note">Error loading digest for ${escapeHtml(date)}: ${escapeHtml(err.message)}</p>`;
  }
}

function renderDigest(data, board) {
  const curated = data.curated || [];
  board.innerHTML = "";

  if (curated.length === 0) {
    board.innerHTML = `<p class="empty-note">No markets/macro headlines found for this date.</p>`;
    return;
  }

  const bySource = {};
  for (const item of curated) {
    if (!bySource[item.source]) bySource[item.source] = [];
    bySource[item.source].push(item);
  }

  for (const name of SOURCE_ORDER) {
    const items = bySource[name];
    if (!items || items.length === 0) continue;

    const card = document.createElement("section");
    card.className = "source-card";

    const heading = document.createElement("h2");
    heading.textContent = name;
    card.appendChild(heading);

    const list = document.createElement("ul");
    for (const item of items) list.appendChild(renderItem(item, { withTags: true }));
    card.appendChild(list);

    board.appendChild(card);
  }
}

function renderItem(item, { withTags = false } = {}) {
  const li = document.createElement("li");

  const link = document.createElement("a");
  link.href = item.link;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.title;
  li.appendChild(link);

  if (withTags && item.tags && item.tags.length) {
    const tagRow = document.createElement("div");
    tagRow.className = "tag-row";
    for (const tag of item.tags) {
      const badge = document.createElement("span");
      badge.className = `tag tag-${tag}`;
      badge.textContent = tag;
      tagRow.appendChild(badge);
    }
    li.appendChild(tagRow);
  }

  if (item.summary) {
    const summary = document.createElement("p");
    summary.className = "item-summary";
    summary.textContent = item.summary;
    li.appendChild(summary);
  }

  if (item.pubDate) {
    const date = document.createElement("span");
    date.className = "item-date";
    date.textContent = formatDateTime(new Date(item.pubDate));
    li.appendChild(date);
  }

  return li;
}

function formatDateTime(d) {
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDateLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const weekday = d.toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
  const date = d.toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
  return `${weekday}, ${date}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
