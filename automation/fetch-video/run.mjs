import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";
import { fetchRssFeed } from "../shared/rss-fetcher.mjs";

const TOP3_OUTPUT_FILE = new URL("../../public/content/video/top3.json", import.meta.url);
const EXPANDED_OUTPUT_FILE = new URL("../../public/content/video/top.json", import.meta.url);
const SECTION_NAME = "Top 3 Video";
const EXPANDED_SECTION_NAME = "Expanded Video";
const TOP3_COUNT = 3;
const EXPANDED_COUNT = 12;

const VIDEO_FEEDS = [
  {
    source: "BBC Video",
    url: "https://feeds.bbci.co.uk/news/video_and_audio/video/rss.xml",
    defaultTag: "Video",
  },
  {
    source: "Reuters Video",
    url: "https://feeds.reuters.com/reuters/video",
    defaultTag: "Video",
  },
  {
    source: "Al Jazeera Video",
    url: "https://www.aljazeera.com/xml/rss/video.xml",
    defaultTag: "Video",
  },
  {
    source: "YouTube - BBC News",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC16niRr50-MSBwiO3YDb3RA",
    defaultTag: "Video",
  },
  {
    source: "YouTube - Reuters",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=UChqURNrGhbh1wA5WS0jct_Q",
    defaultTag: "Video",
  },
  {
    source: "Vimeo - National Geographic",
    url: "https://vimeo.com/channels/natgeo/videos/rss",
    defaultTag: "Video",
  },
  {
    source: "Dailymotion - BBC News",
    url: "https://www.dailymotion.com/rss/user/bbcnews",
    defaultTag: "Video",
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
    embedUrl: getEmbedUrl(article.url),
  };
}

function buildArticleId(article, source) {
  const slug = slugify(article.title).slice(0, 48) || "video-item";
  const fingerprint = createHash("sha1")
    .update(`${source.source}|${article.url}|${article.publishedAt}`)
    .digest("hex")
    .slice(0, 10);

  return `video-${slug}-${fingerprint}`;
}

function buildSummary(article, source) {
  return `XLB brief: a timely ${source.defaultTag.toLowerCase()} item from ${source.source}, selected from the current source feed for quick context and source-first reading.`;
}

function buildWhyItMatters(article, source) {
  return `Video content provides visual context and can help explain why current events matter in a way that text alone cannot.`;
}

function getEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, "");

    if (hostname.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v");
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

function selectTopArticles(articles, count) {
  const deduped = [];
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

    addArticle(article, deduped, seenUrls, seenTitles);

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
  const results = await Promise.allSettled(VIDEO_FEEDS.map((source) => fetchRssFeed(source)));
  const articles = [];

  results.forEach((result, index) => {
    const source = VIDEO_FEEDS[index];

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
