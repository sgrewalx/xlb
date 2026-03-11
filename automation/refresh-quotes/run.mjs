import { readFile } from "node:fs/promises";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const OUTPUT_FILE = new URL("../../public/content/quotes/quotes.json", import.meta.url);
const SOURCE_FILE = new URL("./source.json", import.meta.url);
const QUOTES_PER_REFRESH = 5;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

async function main() {
  const library = await loadLibrary();

  if (library.length < QUOTES_PER_REFRESH) {
    throw new Error(`Expected at least ${QUOTES_PER_REFRESH} source quotes, received ${library.length}`);
  }

  const nextItems = selectQuotes(library);
  const existing = await readJsonIfExists(OUTPUT_FILE);

  if (existing && JSON.stringify(existing.items) === JSON.stringify(nextItems)) {
    console.log("No quote rotation change detected; manifest left unchanged.");
    return;
  }

  const changed = await writeJsonIfChanged(OUTPUT_FILE, {
    updatedAt: new Date().toISOString(),
    items: nextItems,
  });

  console.log(
    changed
      ? "Updated public/content/quotes/quotes.json"
      : "public/content/quotes/quotes.json already matched generated output",
  );
}

async function loadLibrary() {
  const contents = await readFile(SOURCE_FILE, "utf8");
  const json = JSON.parse(contents);

  if (!Array.isArray(json.items)) {
    throw new Error("Quote source library must contain an items array");
  }

  return json.items;
}

function selectQuotes(library) {
  const startIndex = getRotationIndex(library.length);
  const items = [];

  for (let offset = 0; offset < QUOTES_PER_REFRESH; offset += 1) {
    items.push(library[(startIndex + offset) % library.length]);
  }

  return items;
}

function getRotationIndex(size) {
  const currentDay = Math.floor(Date.now() / DAY_IN_MS);
  return currentDay % size;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
