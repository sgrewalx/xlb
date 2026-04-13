import { readFile } from "node:fs/promises";
import path from "node:path";

const BLOCK_REGEX = /<(item|entry)\b[\s\S]*?<\/\1>/gi;
const XML_ENTITIES = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export async function fetchRssFeed(feed) {
  const xml = await loadFeedXml(feed);
  const articles = parseFeed(xml, feed);

  if (articles.length === 0) {
    throw new Error(`Feed returned no parseable entries: ${feed.source}`);
  }

  return articles;
}

async function loadFeedXml(feed) {
  const fixtureDir = process.env.XLB_RSS_FIXTURE_DIR;

  if (fixtureDir && feed.fixture) {
    const fixturePath = path.join(fixtureDir, feed.fixture);

    try {
      return await readFile(fixturePath, "utf8");
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  const response = await fetch(feed.url, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "user-agent": "xlb-news-automation/1.0",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Feed request failed for ${feed.source}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseFeed(xml, feed) {
  const blocks = xml.match(BLOCK_REGEX) ?? [];

  return blocks
    .map((block) => normalizeEntry(block, feed))
    .filter(Boolean);
}

function normalizeEntry(block, feed) {
  const title = cleanText(extractFirst(block, ["title"]));
  const rawLink = extractLink(block);
  const url = canonicalizeUrl(rawLink);
  const publishedAt = toIsoDate(
    extractFirst(block, ["pubDate", "published", "updated", "dc:date"]),
  );
  const categories = extractMany(block, ["category", "dc:subject"]);
  const excerpt = cleanExcerpt(
    extractFirst(block, ["description", "summary", "content:encoded"]),
  );
  const tag = normalizeSportsTag(categories, feed.defaultTag ?? "Sports", title, excerpt);

  if (!title || !url || !publishedAt) {
    return null;
  }

  return {
    source: feed.source,
    tag,
    title,
    excerpt,
    url,
    publishedAt,
  };
}

function extractLink(block) {
  const linkText = extractFirst(block, ["link"]);

  if (linkText) {
    return linkText;
  }

  const atomMatch = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  return atomMatch ? decodeXml(atomMatch[1].trim()) : "";
}

function extractFirst(block, tags) {
  for (const tag of tags) {
    const expression = new RegExp(
      `<${escapeRegex(tag)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tag)}>`,
      "i",
    );
    const match = block.match(expression);

    if (match) {
      return match[1];
    }
  }

  return "";
}

function extractMany(block, tags) {
  return tags.flatMap((tag) => {
    const expression = new RegExp(
      `<${escapeRegex(tag)}\\b[^>]*>([\\s\\S]*?)<\\/${escapeRegex(tag)}>`,
      "gi",
    );

    return Array.from(block.matchAll(expression), (match) => cleanText(match[1])).filter(Boolean);
  });
}

function cleanText(value) {
  return decodeXml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSportsTag(categories, defaultTag, title, excerpt) {
  const normalizedCategories = categories
    .flatMap((value) => cleanText(value).toLowerCase().split(/[|,/]+/g))
    .map((value) => value.trim())
    .filter(Boolean);

  for (const category of normalizedCategories) {
    if (category.includes("football") || category.includes("soccer")) {
      return "Football";
    }

    if (category.includes("basketball")) {
      return "Basketball";
    }

    if (category.includes("tennis")) {
      return "Tennis";
    }

    if (category.includes("cricket")) {
      return "Cricket";
    }

    if (
      category.includes("athletics") ||
      category.includes("running") ||
      category.includes("track") ||
      category.includes("marathon") ||
      category.includes("olympic") ||
      category.includes("olympics")
    ) {
      return "Running";
    }
  }

  const combinedText = `${title} ${excerpt}`;
  const inferredTag = inferSportsTagFromText(combinedText);

  if (inferredTag) {
    return inferredTag;
  }

  return cleanTag(defaultTag);
}

function inferSportsTagFromText(text) {
  const normalized = cleanText(text).toLowerCase();

  if (normalized.includes("football") || normalized.includes("soccer")) {
    return "Football";
  }

  if (normalized.includes("basketball")) {
    return "Basketball";
  }

  if (normalized.includes("tennis")) {
    return "Tennis";
  }

  if (normalized.includes("cricket")) {
    return "Cricket";
  }

  if (
    normalized.includes("athletics") ||
    normalized.includes("running") ||
    normalized.includes("track") ||
    normalized.includes("marathon") ||
    normalized.includes("olympic") ||
    normalized.includes("olympics")
  ) {
    return "Running";
  }

  return "";
}

function cleanTag(value) {
  const cleaned = cleanText(value).replace(/[|/]+/g, " ").trim();

  if (!cleaned) {
    return "World";
  }

  // Special case for US to keep it uppercase
  if (cleaned.toUpperCase() === "US") {
    return "US";
  }

  return cleaned
    .split(/\s+/)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function cleanExcerpt(value) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "";
  }

  return cleaned.length > 180 ? `${cleaned.slice(0, 177).trim()}...` : cleaned;
}

function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (match, entity) => XML_ENTITIES[entity] ?? match);
}

function canonicalizeUrl(value) {
  try {
    const url = new URL(cleanText(value));

    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) {
        url.searchParams.delete(key);
      }
    }

    url.hash = "";

    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }

    return url.toString();
  } catch {
    return "";
  }
}

function toIsoDate(value) {
  const cleaned = cleanText(value);

  if (!cleaned) {
    return "";
  }

  const date = new Date(cleaned);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
