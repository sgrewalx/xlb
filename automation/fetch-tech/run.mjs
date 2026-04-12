import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import { fetchRssFeed } from "../shared/rss-fetcher.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(ROOT, "../../public/content/tech");
const TOP3_OUTPUT_FILE = path.join(OUTPUT_DIR, "top3.json");
const EXPANDED_OUTPUT_FILE = path.join(OUTPUT_DIR, "top.json");

const TECH_FEEDS = [
  {
    label: "The Verge",
    rss: "https://www.theverge.com/rss/index.xml",
    defaultTag: "Technology",
  },
  {
    label: "TechCrunch",
    rss: "https://techcrunch.com/feed/",
    defaultTag: "Technology",
  },
  {
    label: "Ars Technica",
    rss: "https://feeds.arstechnica.com/arstechnica/index",
    defaultTag: "Technology",
  },
  {
    label: "Wired",
    rss: "https://www.wired.com/feed/rss",
    defaultTag: "Technology",
  },
  {
    label: "Engadget",
    rss: "https://www.engadget.com/rss.xml",
    defaultTag: "Technology",
  },
  {
    label: "Reuters Technology",
    rss: "https://feeds.reuters.com/reuters/technologyNews",
    defaultTag: "Technology",
  },
  {
    label: "BBC Technology",
    rss: "https://feeds.bbci.co.uk/news/technology/rss.xml",
    defaultTag: "Technology",
  },
];

const TOP3_COUNT = 3;
const EXPANDED_COUNT = 12;

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function normalizeTag(tag) {
  return tag?.toLowerCase().trim() || "technology";
}

function buildItem(source, article) {
  const tags = Array.from(
    new Set([
      source.defaultTag,
      ...(article.tags || []),
      article.category,
    ].filter(Boolean).map(normalizeTag))
  );

  return {
    id: `${source.label.toLowerCase().replace(/\W+/g, "-")}-${slugify(article.title)}`,
    path: article.link,
    title: article.title,
    description: article.description || article.summary || "",
    source: source.label,
    publishedAt: article.published || article.pubDate || new Date().toISOString(),
    categories: tags,
  };
}

function sortArticles(items) {
  return [...items].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function dedupeArticles(items) {
  const seen = new Set();
  return items.filter((article) => {
    const signature = `${article.title}|${article.path}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function buildManifest(items) {
  return {
    updatedAt: new Date().toISOString(),
    items,
  };
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n");
}

async function run() {
  const results = await Promise.allSettled(
    TECH_FEEDS.map(async (source) => {
      const feed = await fetchRssFeed(source.rss);
      return {
        source,
        items: (feed?.items || []).map((item) => buildItem(source, item)),
      };
    })
  );

  const allItems = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
    }
  }

  const distinctItems = dedupeArticles(allItems);
  const sortedItems = sortArticles(distinctItems);
  const expandedItems = sortedItems.slice(0, EXPANDED_COUNT);
  const top3Items = expandedItems.slice(0, TOP3_COUNT);

  await writeJson(EXPANDED_OUTPUT_FILE, buildManifest(expandedItems));
  await writeJson(TOP3_OUTPUT_FILE, buildManifest(top3Items));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
