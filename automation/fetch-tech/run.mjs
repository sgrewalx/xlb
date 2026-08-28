import { createHash } from "node:crypto";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";
import { fetchRssFeed } from "../shared/rss-fetcher.mjs";
import {
  buildTechSelection,
  partitionTechArticles,
} from "./policy.mjs";

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
  {
    source: "Gadgets 360",
    url: "https://gadgets360.com/rssfeeds/default.rss",
    defaultTag: "Technology",
  },
  {
    source: "Tech2",
    url: "https://www.firstpost.com/tech-2/rss",
    defaultTag: "Technology",
  },
  {
    source: "YourStory",
    url: "https://yourstory.com/feed",
    defaultTag: "Technology",
  },
  {
    source: "The Hindu Technology",
    url: "https://www.thehindu.com/sci-tech/technology/?service=rss",
    defaultTag: "Technology",
  },
  {
    source: "Business Standard Tech",
    url: "https://www.business-standard.com/rss/tech-telecom-116.rss",
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
  const raw = article.excerpt || article.summary || "";

  if (raw.trim()) {
    return trimExcerpt(raw, 180);
  }

  return `XLB brief: a timely ${source.defaultTag.toLowerCase()} item from ${source.source}, selected from the current source feed for quick context and source-first reading.`;
}

function trimExcerpt(text, maxLength = 180) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length <= maxLength
    ? cleaned
    : `${cleaned.slice(0, maxLength - 1).trim()}…`;
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

async function run() {
  const generatedAt = new Date();
  const results = await Promise.allSettled(
    TECH_FEEDS.map((source) => fetchRssFeed(source)),
  );

  const articles = [];

  results.forEach((result, index) => {
    const source = TECH_FEEDS[index];

    if (result.status === "fulfilled") {
      const { eligible, rejected } = partitionTechArticles(result.value, generatedAt);
      const rejectionSummary = summarizeRejections(rejected);

      console.log(
        `fetched ${result.value.length} entries from ${source.source}; ${eligible.length} eligible`,
      );

      if (rejected.length > 0) {
        console.warn(`rejected ${rejected.length} from ${source.source}: ${rejectionSummary}`);
      }

      if (eligible.length === 0) {
        console.warn(`omitting ${source.source}: no fresh, eligible Tech entries`);
      }

      articles.push(...eligible);
      return;
    }

    console.warn(`failed ${source.source}: ${result.reason?.message ?? result.reason}`);
  });

  const existingExpanded = await readJsonIfExists(EXPANDED_OUTPUT_FILE);
  const existingTop3 = await readJsonIfExists(TOP3_OUTPUT_FILE);
  const storedItems = [
    ...(existingTop3?.items ?? []),
    ...(existingExpanded?.items ?? []),
  ];
  const { rejected: rejectedStoredItems } = partitionTechArticles(storedItems, generatedAt);

  if (rejectedStoredItems.length > 0) {
    console.warn(
      `rejected ${rejectedStoredItems.length} stored fallback entries: ${summarizeRejections(rejectedStoredItems)}`,
    );
  }

  const { expanded, top3 } = buildTechSelection({
    articles,
    existingTop3,
    existingExpanded,
    referenceTime: generatedAt,
    topCount: TOP3_COUNT,
    expandedCount: EXPANDED_COUNT,
  });

  const nextTop3Items = top3.map((article) => buildItem(article, { source: article.source, defaultTag: article.tag }));
  const nextExpandedItems = expanded.map((article) => buildItem(article, { source: article.source, defaultTag: article.tag }));

  const top3Payload = {
    updatedAt: generatedAt.toISOString(),
    items: nextTop3Items,
  };

  const expandedPayload = {
    updatedAt: generatedAt.toISOString(),
    section: EXPANDED_SECTION_NAME,
    items: nextExpandedItems,
  };

  await writeJsonIfChanged(TOP3_OUTPUT_FILE, top3Payload);
  await writeJsonIfChanged(EXPANDED_OUTPUT_FILE, expandedPayload);
}

function summarizeRejections(rejected) {
  const counts = new Map();

  for (const { reason } of rejected) {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
