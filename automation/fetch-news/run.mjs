import { createHash } from "node:crypto";
import { fetchRssFeed } from "../shared/rss-fetcher.mjs";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const TOP3_OUTPUT_FILE = new URL("../../public/content/news/top3.json", import.meta.url);
const EXPANDED_OUTPUT_FILE = new URL("../../public/content/news/top.json", import.meta.url);
const SECTION_NAME = "Top 3 News";
const EXPANDED_SECTION_NAME = "Expanded News";
const TOP3_COUNT = 3;
const EXPANDED_COUNT = 12;

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

  const expanded = selectTopArticles(articles, EXPANDED_COUNT);
  const selected = expanded.slice(0, TOP3_COUNT);

  if (selected.length < 3) {
    throw new Error(`Expected at least 3 unique articles, received ${selected.length}`);
  }

  const nextTop3Items = selected.map((article) => toManifestItem(article));
  const nextExpandedItems = expanded.map((article) => toManifestItem(article));

  const existingTop3 = await readJsonIfExists(TOP3_OUTPUT_FILE);
  const existingExpanded = await readJsonIfExists(EXPANDED_OUTPUT_FILE);

  if (
    existingTop3 &&
    existingTop3.section === SECTION_NAME &&
    JSON.stringify(existingTop3.items) === JSON.stringify(nextTop3Items) &&
    existingExpanded &&
    existingExpanded.section === EXPANDED_SECTION_NAME &&
    JSON.stringify(existingExpanded.items) === JSON.stringify(nextExpandedItems)
  ) {
    console.log("No news changes detected; manifest left unchanged.");
    return;
  }

  const updatedAt = new Date().toISOString();
  const top3Changed = await writeJsonIfChanged(TOP3_OUTPUT_FILE, {
    updatedAt,
    section: SECTION_NAME,
    items: nextTop3Items,
  });
  const expandedChanged = await writeJsonIfChanged(EXPANDED_OUTPUT_FILE, {
    updatedAt,
    section: EXPANDED_SECTION_NAME,
    items: nextExpandedItems,
  });

  console.log(
    top3Changed
      ? "Updated public/content/news/top3.json"
      : "public/content/news/top3.json already matched generated output",
  );
  console.log(
    expandedChanged
      ? "Updated public/content/news/top.json"
      : "public/content/news/top.json already matched generated output",
  );
}

function selectTopArticles(articles, count) {
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

    addArticle(article, deduped, seenUrls, seenTitles);
    seenSources.add(article.source);

    if (deduped.length === count) {
      break;
    }
  }

  if (deduped.length < count) {
    for (const article of ranked) {
      const normalizedTitle = article.title.toLowerCase();

      if (seenUrls.has(article.url) || seenTitles.has(normalizedTitle)) {
        continue;
      }

      addArticle(article, deduped, seenUrls, seenTitles);

      if (deduped.length === count) {
        break;
      }
    }
  }

  return deduped;
}

function addArticle(article, deduped, seenUrls, seenTitles) {
  seenUrls.add(article.url);
  seenTitles.add(article.title.toLowerCase());
  deduped.push(article);
}

function toManifestItem(article) {
  return {
    id: buildArticleId(article),
    title: article.title,
    source: article.source,
    url: article.url,
    tag: article.tag,
    publishedAt: article.publishedAt,
    summary: buildBrief(article),
    whyItMatters: buildWhyItMatters(article),
  };
}

function buildBrief(article) {
  const raw = article.excerpt || article.summary || "";

  if (raw.trim()) {
    return trimExcerpt(raw, 180);
  }

  return `XLB brief: a timely ${article.tag.toLowerCase()} item from ${article.source}, selected from the current source feed for quick context and source-first reading.`;
}

function trimExcerpt(text, maxLength = 180) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length <= maxLength
    ? cleaned
    : `${cleaned.slice(0, maxLength - 1).trim()}…`;
}

function buildWhyItMatters(article) {
  const normalizedTag = article.tag.toLowerCase();

  if (normalizedTag.includes("climate") || normalizedTag.includes("environment")) {
    return "Climate and environment stories tend to affect everyday decisions, policy choices, and long-term public risk.";
  }

  if (normalizedTag.includes("money") || normalizedTag.includes("business")) {
    return "Money and business signals can change household, market, and work decisions quickly.";
  }

  if (normalizedTag.includes("politic") || normalizedTag.includes("world")) {
    return "World and politics stories can shift public priorities, safety context, and what people need to understand next.";
  }

  return "It adds one useful signal to the current news mix without turning XLB into an overwhelming news feed.";
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
