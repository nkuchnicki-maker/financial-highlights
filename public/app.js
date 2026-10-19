async function loadHeadlines() {
  const board = document.getElementById("board");
  const updated = document.getElementById("updated");
  try {
    const res = await fetch("data/headlines.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data, board, updated);
  } catch (err) {
    updated.textContent = "Could not load headlines.";
    board.innerHTML = `<p class="empty-note">Error loading data/headlines.json: ${escapeHtml(err.message)}</p>`;
  }
}

function render(data, board, updated) {
  const generated = new Date(data.generatedAt);
  updated.textContent = `Last updated ${generated.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;

  board.innerHTML = "";
  const sourceOrder = ["WSJ", "Financial Times", "Bloomberg", "NYT", "Barron's", "MarketWatch"];

  for (const name of sourceOrder) {
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
      for (const item of items) {
        list.appendChild(renderItem(item));
      }
      card.appendChild(list);
    }

    board.appendChild(card);
  }
}

function renderItem(item) {
  const li = document.createElement("li");

  const link = document.createElement("a");
  link.href = item.link;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.title;
  li.appendChild(link);

  if (item.summary) {
    const summary = document.createElement("p");
    summary.className = "item-summary";
    summary.textContent = item.summary;
    li.appendChild(summary);
  }

  if (item.pubDate) {
    const date = document.createElement("span");
    date.className = "item-date";
    date.textContent = new Date(item.pubDate).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    li.appendChild(date);
  }

  return li;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

loadHeadlines();
