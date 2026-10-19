// Writes a dated snapshot under public/data/archive/<date>.json and keeps
// public/data/archive/index.json (list of available dates, newest first)
// up to date — shared by the daily live fetch and the past-date digest
// builder so both write archive entries the same way.
import { writeFile, mkdir, readFile } from "node:fs/promises";

const ARCHIVE_DIR = "public/data/archive";
const INDEX_PATH = `${ARCHIVE_DIR}/index.json`;

async function readIndex() {
  try {
    const raw = await readFile(INDEX_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return { dates: [] };
  }
}

export async function writeArchiveEntry(date, { generatedAt, all, curated }) {
  await mkdir(ARCHIVE_DIR, { recursive: true });
  const payload = { date, generatedAt, curated, all };
  await writeFile(`${ARCHIVE_DIR}/${date}.json`, JSON.stringify(payload, null, 2));

  const index = await readIndex();
  const existing = index.dates.find((d) => d.date === date);
  if (existing) {
    existing.generatedAt = generatedAt;
    existing.curatedCount = curated.length;
  } else {
    index.dates.push({ date, generatedAt, curatedCount: curated.length });
  }
  index.dates.sort((a, b) => (a.date < b.date ? 1 : -1));
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2));
}
