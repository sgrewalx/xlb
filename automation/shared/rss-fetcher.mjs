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
const IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);
const IDENTIFIER_QUERY_KEYS = new Set([
  "email",
  "session_id",
  "sessionid",
  "subscriber_id",
  "user_id",
  "userid",
]);

export async function fetchRssFeed(feed) {
  const xml = await loadFeedXml(feed);
  const articles = parseRssFeed(xml, feed);

  if (articles.length === 0) {
    throw new Error(`Feed returned no parseable entries: ${feed.source}`);
  }

  return articles;
}

export async function verifyArticleImages(
  articles,
  { fetchImpl = fetch, timeoutMs = 10_000 } = {},
) {
  const results = await Promise.all(
    articles.map(async (article) => {
      if (!article.image) {
        return {
          article,
          diagnostic: {
            source: article.source,
            publishedAt: article.publishedAt,
            title: article.title,
            image: "",
            status: "not-supplied",
          },
        };
      }

      const probe = await probeRemoteImage(article.image, { fetchImpl, timeoutMs });

      if (probe.ok) {
        return {
          article,
          diagnostic: {
            source: article.source,
            publishedAt: article.publishedAt,
            title: article.title,
            image: article.image,
            host: new URL(article.image).host,
            contentType: probe.contentType,
            contentLength: probe.contentLength,
            status: "usable",
          },
        };
      }

      const {
        image: _image,
        imageAlt: _imageAlt,
        imageCredit: _imageCredit,
        imageOrigin: _imageOrigin,
        imageSourceUrl: _imageSourceUrl,
        ...articleWithoutImage
      } = article;

      return {
        article: articleWithoutImage,
        diagnostic: {
          source: article.source,
          publishedAt: article.publishedAt,
          title: article.title,
          image: article.image,
          host: new URL(article.image).host,
          status: "rejected",
          reason: probe.reason,
        },
      };
    }),
  );

  return {
    articles: results.map((result) => result.article),
    diagnostics: results.map((result) => result.diagnostic),
  };
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

export function parseRssFeed(xml, feed) {
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

  const image = extractImage(block, title, url);

  return {
    source: feed.source,
    tag,
    title,
    excerpt,
    url,
    publishedAt,
    ...(image ?? {}),
  };
}

function extractImage(block, articleTitle, articleUrl) {
  const candidates = [
    ...extractTagCandidates(block, "media:content", "media-content"),
    ...extractTagCandidates(block, "media:thumbnail", "media-thumbnail"),
    ...extractTagCandidates(block, "enclosure", "image-enclosure"),
    ...extractAtomEnclosures(block),
    ...extractExplicitImageStructures(block),
  ];
  const candidate = candidates.find((item) => isUsableImageCandidate(item));

  if (!candidate) {
    return null;
  }

  const image = canonicalizeImageUrl(candidate.url);
  if (!image) {
    return null;
  }

  const sourceAlt = cleanText(
    candidate.alt ||
      candidate.title ||
      extractFirst(block, ["media:title", "media:description"]),
  );
  const imageAlt = isMeaningfulImageAlt(sourceAlt, articleTitle) ? sourceAlt : "";
  const imageCredit = cleanText(
    candidate.credit || extractFirst(block, ["media:credit"]),
  );

  return {
    image,
    ...(imageAlt ? { imageAlt } : {}),
    ...(imageCredit ? { imageCredit } : {}),
    imageOrigin: "rss",
    imageSourceUrl: articleUrl,
  };
}

function extractTagCandidates(block, tag, mechanism) {
  const expression = new RegExp(`<${escapeRegex(tag)}\\b([^>]*)>`, "gi");

  return Array.from(block.matchAll(expression), (match) => ({
    ...parseAttributes(match[1]),
    mechanism,
  }));
}

function extractAtomEnclosures(block) {
  return extractTagCandidates(block, "link", "atom-enclosure")
    .filter((candidate) => candidate.rel?.toLowerCase() === "enclosure")
    .map((candidate) => ({ ...candidate, url: candidate.href || candidate.url }));
}

function extractExplicitImageStructures(block) {
  const expression = /<image\b[^>]*>[\s\S]*?<url\b[^>]*>([\s\S]*?)<\/url>[\s\S]*?<\/image>/gi;

  return Array.from(block.matchAll(expression), (match) => ({
    mechanism: "image-url",
    url: cleanText(match[1]),
  }));
}

function parseAttributes(value) {
  const attributes = {};
  const expression = /([\w:-]+)\s*=\s*(["'])(.*?)\2/gis;

  for (const match of value.matchAll(expression)) {
    attributes[match[1].toLowerCase()] = decodeXml(match[3].trim());
  }

  return attributes;
}

function isUsableImageCandidate(candidate) {
  const url = candidate.url || candidate.href || "";
  const type = (candidate.type || "").toLowerCase().split(";")[0].trim();
  const medium = (candidate.medium || "").toLowerCase();

  if (candidate.mechanism === "media-content") {
    if (medium === "video" || type.startsWith("video/")) {
      return false;
    }

    if (type && !IMAGE_MIME_TYPES.has(type) && medium !== "image") {
      return false;
    }
  }

  if (["image-enclosure", "atom-enclosure"].includes(candidate.mechanism)) {
    if (!IMAGE_MIME_TYPES.has(type)) {
      return false;
    }
  }

  if (isProvenTiny(candidate.width, candidate.height)) {
    return false;
  }

  return Boolean(canonicalizeImageUrl(url));
}

function isProvenTiny(width, height) {
  const parsedWidth = parseDimension(width);
  const parsedHeight = parseDimension(height);

  return (
    (parsedWidth !== null && parsedWidth < 160) ||
    (parsedHeight !== null && parsedHeight < 90)
  );
}

function parseDimension(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function canonicalizeImageUrl(value) {
  try {
    const url = new URL(cleanText(value));

    if (url.protocol !== "https:" || url.username || url.password) {
      return "";
    }

    if (/\.(?:avi|mov|mp3|mp4|pdf|webm|zip)$/i.test(url.pathname)) {
      return "";
    }

    if (/(?:^|[-_/])(1x1|beacon|blank|pixel|spacer|tracking)(?:[-_.\/]|$)/i.test(url.pathname)) {
      return "";
    }

    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();

      if (IDENTIFIER_QUERY_KEYS.has(normalizedKey)) {
        return "";
      }

      if (normalizedKey.startsWith("utm_") || TRACKING_QUERY_KEYS.has(normalizedKey)) {
        url.searchParams.delete(key);
      }
    }

    const queryWidth = Number(url.searchParams.get("width") ?? url.searchParams.get("w"));
    const queryHeight = Number(url.searchParams.get("height") ?? url.searchParams.get("h"));
    if (
      (Number.isFinite(queryWidth) && queryWidth > 0 && queryWidth < 160) ||
      (Number.isFinite(queryHeight) && queryHeight > 0 && queryHeight < 90)
    ) {
      return "";
    }

    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function isMeaningfulImageAlt(value, articleTitle) {
  if (!value || value.length < 4) {
    return false;
  }

  const normalize = (text) => text.toLowerCase().replace(/\W+/g, " ").trim();
  return normalize(value) !== normalize(articleTitle);
}

async function probeRemoteImage(image, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(image, {
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1",
        range: "bytes=0-4095",
        "user-agent": "xlb-image-validator/1.0",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    const rawContentType = response.headers.get("content-type") || "";
    const contentType = rawContentType
      .toLowerCase()
      .split(",")
      .map((value) => value.split(";")[0].trim())
      .find((value) => IMAGE_MIME_TYPES.has(value));
    if (!contentType) {
      return { ok: false, reason: `unsupported content type ${rawContentType || "missing"}` };
    }

    const rawLength = response.headers.get("content-length");
    const contentLength = rawLength === null ? null : Number(rawLength);
    if (contentLength !== null && (!Number.isFinite(contentLength) || contentLength < 512)) {
      return { ok: false, reason: `content length ${rawLength} is too small` };
    }

    if (response.body?.cancel) {
      await response.body.cancel();
    }

    return { ok: true, contentType, contentLength };
  } catch (error) {
    return {
      ok: false,
      reason: error?.name === "AbortError" ? "request timed out" : String(error?.message ?? error),
    };
  } finally {
    clearTimeout(timer);
  }
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
