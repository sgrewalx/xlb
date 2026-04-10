import { createHash } from "node:crypto";
import { fetchRssFeed } from "../shared/rss-fetcher.mjs";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const OUTPUT_FILE = new URL("../../public/content/news/top3.json", import.meta.url);
const SECTION_NAME = "Top 3 News";

const NEWS_FEEDS = [
  {
    source: "BBC",
    url: "https://feeds.bbci.co.uk/news/world/rss.xml",
    defaultTag: "World",
    fixture: "bbc.xml",
  },
  {
    source: "BBC",
    url: "https://feeds.bbci.co.uk/news/business/rss.xml",
    defaultTag: "Money",
  },
  {
    source: "BBC",
    url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
    defaultTag: "Climate",
  },
  {
    source: "Al Jazeera",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
    defaultTag: "World",
    fixture: "aljazeera.xml",
  },
  {
    source: "The Guardian",
    url: "https://www.theguardian.com/world/rss",
    defaultTag: "World",
  },
  {
    source: "The New York Times",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    defaultTag: "World",
  },
  {
    source: "NPR",
    url: "https://feeds.npr.org/1004/rss.xml",
    defaultTag: "World",
  },
];

async function main() {
  const results = await Promise.allSettled(NEWS_FEEDS.map((feed) => fetchRssFeed(feed)));
  const articles = [];

  results.forEach((result, index) => {
    const feed = NEWS_FEEDS[index];

    if (result.status === "fulfilled") {
      console.log(`fetched ${result.value.length} entries from ${feed.source}`);
      articles.push(...result.value);
      return;
    }

    console.warn(`failed ${feed.source}: ${formatError(result.reason)}`);
  });

  const selected = selectTopArticles(articles);

  if (selected.length < 3) {
    throw new Error(`Expected at least 3 unique articles, received ${selected.length}`);
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
    console.log("No news changes detected; manifest left unchanged.");
    return;
  }

  const changed = await writeJsonIfChanged(OUTPUT_FILE, {
    updatedAt: new Date().toISOString(),
    section: SECTION_NAME,
    items: nextItems,
  });

  console.log(
    changed
      ? "Updated public/content/news/top3.json"
      : "public/content/news/top3.json already matched generated output",
  );
}

function selectTopArticles(articles) {
  const deduped = [];
  const seenSources = new Set();
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

    if (seenSources.has(article.source)) {
      continue;
    }

    seenSources.add(article.source);
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
  const slug = slugify(article.title).slice(0, 48) || "news-item";
  const fingerprint = createHash("sha1")
    .update(`${article.source}|${article.url}|${article.publishedAt}`)
    .digest("hex")
    .slice(0, 10);

  return `news-${slug}-${fingerprint}`;
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
