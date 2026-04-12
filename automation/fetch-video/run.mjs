import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import { fetchRssFeed } from "../shared/rss-fetcher.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(ROOT, "../../public/content/video");
const TOP3_OUTPUT_FILE = path.join(OUTPUT_DIR, "top3.json");
const EXPANDED_OUTPUT_FILE = path.join(OUTPUT_DIR, "top.json");

const VIDEO_FEEDS = [
  {
    label: "BBC Video",
    rss: "https://feeds.bbci.co.uk/news/video_and_audio/video/rss.xml",
    defaultTag: "Video",
  },
  {
    label: "Reuters Video",
    rss: "https://feeds.reuters.com/reuters/video",
    defaultTag: "Video",
  },
  {
    label: "Al Jazeera Video",
    rss: "https://www.aljazeera.com/xml/rss/video.xml",
    defaultTag: "Video",
  },
  {
    label: "YouTube - BBC News",
    rss: "https://www.youtube.com/feeds/videos.xml?channel_id=UC16niRr50-MSBwiO3YDb3RA",
    defaultTag: "Video",
  },
  {
    label: "YouTube - Reuters",
    rss: "https://www.youtube.com/feeds/videos.xml?channel_id=UChqURNrGhbh1wA5WS0jct_Q",
    defaultTag: "Video",
  },
  {
    label: "Vimeo - National Geographic",
    rss: "https://vimeo.com/channels/natgeo/videos/rss",
    defaultTag: "Video",
  },
  {
    label: "Dailymotion - BBC News",
    rss: "https://www.dailymotion.com/rss/user/bbcnews",
    defaultTag: "Video",
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
  return tag?.toLowerCase().trim() || "video";
}

function buildItem(source, article) {
  const tags = Array.from(
    new Set([
      source.defaultTag,
      article.tag,
    ].filter(Boolean).map(normalizeTag))
  );

  return {
    id: `${source.label.toLowerCase().replace(/\W+/g, "-")}-${slugify(article.title)}`,
    url: article.url,
    title: article.title,
    description: article.excerpt || "",
    source: source.label,
    publishedAt: article.publishedAt || new Date().toISOString(),
    tag: article.tag || source.defaultTag,
    embedUrl: getEmbedUrl(article.url),
  };
}

function getEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, "");

    if (hostname.includes("youtube.com")) {
      const params = parsed.searchParams;
      const videoId = params.get("v");
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?rel=0`;
      }
    }

    if (hostname.includes("youtu.be")) {
      const videoId = pathname.split("/").filter(Boolean).pop();
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?rel=0`;
      }
    }

    if (hostname.includes("vimeo.com")) {
      const videoId = pathname.split("/").filter(Boolean).pop();
      if (videoId) {
        return `https://player.vimeo.com/video/${videoId}`;
      }
    }

    if (hostname.includes("dailymotion.com")) {
      const match = pathname.match(/video\/([^_/]+)/);
      if (match) {
        return `https://www.dailymotion.com/embed/video/${match[1]}`;
      }
    }

    return null;
  } catch {
    return null;
  }
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
    VIDEO_FEEDS.map(async (source) => {
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
