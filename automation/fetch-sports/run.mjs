import { createHash } from "node:crypto";
import { fetchRssFeed } from "../shared/rss-fetcher.mjs";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const OUTPUT_FILE = new URL("../../public/content/sports/top3.json", import.meta.url);
const SECTION_NAME = "Top 3 Sports";

const SPORTS_FEEDS = [
  {
    source: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/football/rss.xml",
    defaultTag: "Football",
  },
  {
    source: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/basketball/rss.xml",
    defaultTag: "Basketball",
  },
  {
    source: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/tennis/rss.xml",
    defaultTag: "Tennis",
  },
];

async function main() {
  const results = await Promise.allSettled(SPORTS_FEEDS.map((feed) => fetchRssFeed(feed)));
  const articles = [];

  results.forEach((result, index) => {
    const feed = SPORTS_FEEDS[index];

    if (result.status === "fulfilled") {
      console.log(`fetched ${result.value.length} entries from ${feed.defaultTag}`);
      articles.push(...result.value.map((entry) => ({ ...entry, tag: feed.defaultTag })));
      return;
    }

    console.warn(`failed ${feed.defaultTag}: ${formatError(result.reason)}`);
  });

  const selected = selectTopArticles(articles);

  if (selected.length < 3) {
    throw new Error(`Expected at least 3 unique sports articles, received ${selected.length}`);
  }

  const nextItems = selected.map((article) => ({
    id: buildArticleId(article),
    title: article.title,
    source: article.source,
    url: article.url,
    tag: article.tag,
    publishedAt: article.publishedAt,
  }));

  const existing = await readJsonIfExists(OUTPUT_FILE);

  if (
    existing &&
    existing.section === SECTION_NAME &&
    JSON.stringify(existing.items) === JSON.stringify(nextItems)
  ) {
    console.log("No sports changes detected; manifest left unchanged.");
    return;
  }

  const changed = await writeJsonIfChanged(OUTPUT_FILE, {
    updatedAt: new Date().toISOString(),
    section: SECTION_NAME,
    items: nextItems,
  });

  console.log(
    changed
      ? "Updated public/content/sports/top3.json"
      : "public/content/sports/top3.json already matched generated output",
  );
}

function selectTopArticles(articles) {
  const deduped = [];
  const seenTags = new Set();
  const seenUrls = new Set();
  const seenTitles = new Set();

  const ranked = [...articles].sort(
    (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
  );

  for (const article of ranked) {
    const normalizedTitle = article.title.toLowerCase();

    if (seenUrls.has(article.url) || seenTitles.has(normalizedTitle)) {
      continue;
    }

    if (seenTags.has(article.tag)) {
      continue;
    }

    seenTags.add(article.tag);
    seenUrls.add(article.url);
    seenTitles.add(normalizedTitle);
    deduped.push(article);

    if (deduped.length === 3) {
      break;
    }
  }

  return deduped;
}

function buildArticleId(article) {
  const slug = slugify(article.title).slice(0, 48) || "sports-item";
  const fingerprint = createHash("sha1")
    .update(`${article.source}|${article.url}|${article.publishedAt}`)
    .digest("hex")
    .slice(0, 10);

  return `sports-${slug}-${fingerprint}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
