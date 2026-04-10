import { createHash } from "node:crypto";
import { fetchRssFeed } from "../shared/rss-fetcher.mjs";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const TOP3_OUTPUT_FILE = new URL("../../public/content/sports/top3.json", import.meta.url);
const EXPANDED_OUTPUT_FILE = new URL("../../public/content/sports/top.json", import.meta.url);
const SECTION_NAME = "Top 3 Sports";
const EXPANDED_SECTION_NAME = "Expanded Sports";
const TOP3_COUNT = 3;
const EXPANDED_COUNT = 12;

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
  {
    source: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/cricket/rss.xml",
    defaultTag: "Cricket",
  },
  {
    source: "BBC Sport",
    url: "https://feeds.bbci.co.uk/sport/athletics/rss.xml",
    defaultTag: "Running",
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

  const expanded = selectTopArticles(articles, EXPANDED_COUNT);
  const selected = expanded.slice(0, TOP3_COUNT);

  if (selected.length < 3) {
    throw new Error(`Expected at least 3 unique sports articles, received ${selected.length}`);
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
    console.log("No sports changes detected; manifest left unchanged.");
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
      ? "Updated public/content/sports/top3.json"
      : "public/content/sports/top3.json already matched generated output",
  );
  console.log(
    expandedChanged
      ? "Updated public/content/sports/top.json"
      : "public/content/sports/top.json already matched generated output",
  );
}

function selectTopArticles(articles, count) {
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

    addArticle(article, deduped, seenUrls, seenTitles);
    seenTags.add(article.tag);

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
  return `XLB brief: a fresh ${article.tag.toLowerCase()} item from ${article.source}, kept short so the page stays scan-first and source-linked.`;
}

function buildWhyItMatters(article) {
  const tag = article.tag.toLowerCase();

  if (tag === "cricket") {
    return "Cricket gives XLB a stronger India-relevant sports lane and a reason for repeat sports check-ins.";
  }

  if (tag === "running") {
    return "Running and athletics widen the page beyond match coverage into performance and training stories.";
  }

  if (tag === "football") {
    return "Football creates regular global sports momentum and quick-return storylines.";
  }

  return "It adds variety to the sports mix without turning the page into a full sports wire.";
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
