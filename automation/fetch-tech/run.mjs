import { createHash } from "node:crypto";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";
import { fetchRssFeed } from "../shared/rss-fetcher.mjs";

const TOP3_OUTPUT_FILE = new URL("../../public/content/tech/top3.json", import.meta.url);
const EXPANDED_OUTPUT_FILE = new URL("../../public/content/tech/top.json", import.meta.url);
const SECTION_NAME = "Top 3 Tech";
const EXPANDED_SECTION_NAME = "Expanded Tech";
const TOP3_COUNT = 3;
const EXPANDED_COUNT = 12;

const TECH_FEEDS = [
  {
    source: "The Verge",
    url: "https://www.theverge.com/rss/index.xml",
    defaultTag: "Technology",
  },
  {
    source: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    defaultTag: "Technology",
  },
  {
    source: "Ars Technica",
    url: "https://feeds.arstechnica.com/arstechnica/index",
    defaultTag: "Technology",
  },
  {
    source: "Wired",
    url: "https://www.wired.com/feed/rss",
    defaultTag: "Technology",
  },
  {
    source: "Engadget",
    url: "https://www.engadget.com/rss.xml",
    defaultTag: "Technology",
  },
  {
    source: "Reuters Technology",
    url: "https://feeds.reuters.com/reuters/technologyNews",
    defaultTag: "Technology",
  },
  {
    source: "BBC Technology",
    url: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    defaultTag: "Technology",
  },
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function buildItem(article, source) {
  return {
    id: buildArticleId(article, source),
    title: article.title,
    source: source.source,
    url: article.url,
    tag: article.tag || source.defaultTag,
    publishedAt: article.publishedAt,
    summary: buildSummary(article, source),
    whyItMatters: buildWhyItMatters(article, source),
  };
}

function buildArticleId(article, source) {
  const slug = slugify(article.title).slice(0, 48) || "tech-item";
  const fingerprint = createHash("sha1")
    .update(`${source.source}|${article.url}|${article.publishedAt}`)
    .digest("hex")
    .slice(0, 10);

  return `tech-${slug}-${fingerprint}`;
}

function buildSummary(article, source) {
  return `XLB brief: a timely ${source.defaultTag.toLowerCase()} item from ${source.source}, selected from the current source feed for quick context and source-first reading.`;
}

function buildWhyItMatters(article, source) {
  const normalizedTag = (article.tag || source.defaultTag).toLowerCase();

  if (normalizedTag.includes("ai") || normalizedTag.includes("artificial intelligence")) {
    return "AI stories matter because they can change how people work, consume, and trust digital products.";
  }

  if (normalizedTag.includes("privacy") || normalizedTag.includes("security")) {
    return "Privacy and security updates help people and teams make safer technology choices.";
  }

  if (normalizedTag.includes("hardware") || normalizedTag.includes("chip")) {
    return "Hardware and supply chain signals are important for product delivery, cost, and planning.";
  }

  return "Technology updates can influence strategy, risk, and the speed of change across digital products.";
}

function selectTopArticles(articles, count) {
  const deduped = [];
  const seenUrls = new Set();
  const seenTitles = new Set();
  const seenSources = new Set();

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

function mergeFallbackItems(primaryItems, fallbackItems, targetCount) {
  const seen = new Set(primaryItems.map((item) => item.id));
  const merged = [...primaryItems];

  for (const item of fallbackItems) {
    if (merged.length >= targetCount) break;
    if (!seen.has(item.id)) {
      merged.push(item);
      seen.add(item.id);
    }
  }

  return merged;
}

async function run() {
  const results = await Promise.allSettled(
    TECH_FEEDS.map((source) => fetchRssFeed(source)),
  );

  const articles = [];

  results.forEach((result, index) => {
    const source = TECH_FEEDS[index];

    if (result.status === "fulfilled") {
      console.log(`fetched ${result.value.length} entries from ${source.source}`);
      articles.push(...result.value);
      return;
    }

    console.warn(`failed ${source.source}: ${result.reason?.message ?? result.reason}`);
  });

  const expanded = selectTopArticles(articles, EXPANDED_COUNT);
  let top3 = expanded.slice(0, TOP3_COUNT);

  const existingExpanded = await readJsonIfExists(EXPANDED_OUTPUT_FILE);
  const existingTop3 = await readJsonIfExists(TOP3_OUTPUT_FILE);

  if (expanded.length < TOP3_COUNT && existingExpanded?.items?.length >= TOP3_COUNT) {
    expanded.splice(0, expanded.length, ...existingExpanded.items.slice(0, EXPANDED_COUNT));
  }

  if (top3.length < TOP3_COUNT) {
    const fallbackItems = [];

    if (existingTop3?.items?.length) {
      fallbackItems.push(...existingTop3.items);
    }

    if (existingExpanded?.items?.length) {
      fallbackItems.push(...existingExpanded.items);
    }

    top3 = mergeFallbackItems(top3, fallbackItems, TOP3_COUNT);
  }

  if (expanded.length < TOP3_COUNT) {
    expanded.splice(0, expanded.length, ...top3.slice(0, EXPANDED_COUNT));
  }

  const nextTop3Items = top3.map((article) => buildItem(article, { source: article.source, defaultTag: article.tag }));
  const nextExpandedItems = expanded.map((article) => buildItem(article, { source: article.source, defaultTag: article.tag }));

  const top3Payload = {
    updatedAt: new Date().toISOString(),
    items: nextTop3Items,
  };

  const expandedPayload = {
    updatedAt: new Date().toISOString(),
    section: EXPANDED_SECTION_NAME,
    items: nextExpandedItems,
  };

  await writeJsonIfChanged(TOP3_OUTPUT_FILE, top3Payload);
  await writeJsonIfChanged(EXPANDED_OUTPUT_FILE, expandedPayload);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
