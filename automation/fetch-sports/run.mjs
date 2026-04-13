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
  {
    source: "ESPN",
    url: "https://www.espn.com/espn/rss/soccer/news",
    defaultTag: "Football",
  },
  {
    source: "ESPN",
    url: "https://www.espn.com/espn/rss/basketball/news",
    defaultTag: "Basketball",
  },
  {
    source: "ESPN",
    url: "https://www.espn.com/espn/rss/tennis/news",
    defaultTag: "Tennis",
  },
  {
    source: "ESPN",
    url: "https://www.espn.com/espn/rss/cricket/news",
    defaultTag: "Cricket",
  },
  {
    source: "ESPN",
    url: "https://www.espn.com/espn/rss/olympics/news",
    defaultTag: "Running",
  },
  {
    source: "The Guardian",
    url: "https://www.theguardian.com/football/rss",
    defaultTag: "Football",
  },
  {
    source: "The Guardian",
    url: "https://www.theguardian.com/sport/basketball/rss",
    defaultTag: "Basketball",
  },
  {
    source: "The Guardian",
    url: "https://www.theguardian.com/sport/tennis/rss",
    defaultTag: "Tennis",
  },
  {
    source: "The Guardian",
    url: "https://www.theguardian.com/sport/cricket/rss",
    defaultTag: "Cricket",
  },
  {
    source: "The Guardian",
    url: "https://www.theguardian.com/sport/athletics/rss",
    defaultTag: "Running",
  },
  {
    source: "AP News",
    url: "https://feeds.apnews.com/rss/sports/football",
    defaultTag: "Football",
  },
  {
    source: "AP News",
    url: "https://feeds.apnews.com/rss/sports/basketball",
    defaultTag: "Basketball",
  },
  {
    source: "AP News",
    url: "https://feeds.apnews.com/rss/sports/tennis",
    defaultTag: "Tennis",
  },
  {
    source: "AP News",
    url: "https://feeds.apnews.com/rss/sports/cricket",
    defaultTag: "Cricket",
  },
  {
    source: "AP News",
    url: "https://feeds.apnews.com/rss/sports/olympics",
    defaultTag: "Running",
  },
  {
    source: "Reuters",
    url: "https://feeds.reuters.com/reuters/footballNews",
    defaultTag: "Football",
  },
  {
    source: "Reuters",
    url: "https://feeds.reuters.com/reuters/basketballNews",
    defaultTag: "Basketball",
  },
  {
    source: "Reuters",
    url: "https://feeds.reuters.com/reuters/tennisNews",
    defaultTag: "Tennis",
  },
  {
    source: "Reuters",
    url: "https://feeds.reuters.com/reuters/cricketNews",
    defaultTag: "Cricket",
  },
  {
    source: "Reuters",
    url: "https://feeds.reuters.com/reuters/olympicsNews",
    defaultTag: "Running",
  },
  {
    source: "CNN",
    url: "https://rss.cnn.com/rss/edition_sport.rss",
    defaultTag: "Sports",
  },
  {
    source: "New York Times",
    url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml",
    defaultTag: "Sports",
  },
  {
    source: "Sky Sports",
    url: "https://www.skysports.com/rss/12040",
    defaultTag: "Football",
  },
  {
    source: "CBS Sports",
    url: "https://www.cbssports.com/rss/headlines/",
    defaultTag: "Sports",
  },
  {
    source: "NBC Sports",
    url: "https://www.nbcsports.com/index.atom",
    defaultTag: "Sports",
  },
  {
    source: "Fox Sports",
    url: "https://api.foxsports.com/v2/content/optimized-rss?partnerKey=MB0Wehpmuj2lUhuRhQaafhBjAJqaPU244mlTDK1i",
    defaultTag: "Sports",
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
  const raw = article.excerpt || article.summary || "";

  if (raw.trim()) {
    return trimExcerpt(raw, 180);
  }

  return `XLB brief: a fresh ${article.tag.toLowerCase()} item from ${article.source}, kept short so the page stays scan-first and source-linked.`;
}

function trimExcerpt(text, maxLength = 180) {
  const cleaned = text.trim().replace(/\s+/g, " ");
  return cleaned.length <= maxLength
    ? cleaned
    : `${cleaned.slice(0, maxLength - 1).trim()}…`;
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
