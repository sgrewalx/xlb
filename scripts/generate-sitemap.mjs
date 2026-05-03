import { readFile, writeFile } from "node:fs/promises";

const SITE_ORIGIN = "https://xlb.codemachine.in";
const EVENTS_FILE = new URL("../public/content/live/events.json", import.meta.url);
const TOPICS_FILE = new URL("../public/content/topics/index.json", import.meta.url);
const NEWS_FILE = new URL("../public/content/news/top3.json", import.meta.url);
const SPORTS_FILE = new URL("../public/content/sports/top3.json", import.meta.url);
const TECH_FILE = new URL("../public/content/tech/top3.json", import.meta.url);
const VIDEO_FILE = new URL("../public/content/video/top3.json", import.meta.url);
const VIDEO_SHORTS_FILE = new URL("../public/content/video/shorts.json", import.meta.url);
const HOME_MODULES_FILE = new URL("../public/content/home/modules.json", import.meta.url);
const GAMES_FILE = new URL("../public/content/games/catalog.json", import.meta.url);
const GALLERY_FILE = new URL("../public/content/gallery/collections.json", import.meta.url);
const QUOTES_FILE = new URL("../public/content/quotes/quotes.json", import.meta.url);
const XLB_FILE = new URL("../public/content/xlb/top3.json", import.meta.url);
const OUTPUT_FILE = new URL("../public/sitemap.xml", import.meta.url);

const staticPaths = [
  "/",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
  "/advertise",
  "/live",
  "/live/space",
  "/live/earth",
  "/games",
  "/gallery",
  "/sports",
  "/news",
  "/tech",
  "/video",
];

async function main() {
  const [events, topics, news, sports, tech, video, videoShorts, homeModules, games, gallery, quotes, xlb] = await Promise.all([
    readJson(EVENTS_FILE),
    readJson(TOPICS_FILE),
    readJson(NEWS_FILE),
    readJson(SPORTS_FILE),
    readJson(TECH_FILE),
    readJson(VIDEO_FILE),
    readJson(VIDEO_SHORTS_FILE),
    readJson(HOME_MODULES_FILE),
    readJson(GAMES_FILE),
    readJson(GALLERY_FILE),
    readJson(QUOTES_FILE),
    readJson(XLB_FILE),
  ]);
  const homeLastmod = maxDate([
    events.updatedAt,
    topics.updatedAt,
    news.updatedAt,
    sports.updatedAt,
    tech.updatedAt,
    video.updatedAt,
    videoShorts.updatedAt,
    homeModules.updatedAt,
    games.updatedAt,
    gallery.updatedAt,
    quotes.updatedAt,
    xlb.updatedAt,
  ]);
  const pathLastmod = new Map([
    ["/", homeLastmod],
    ["/live", events.updatedAt],
    ["/live/space", events.updatedAt],
    ["/live/earth", events.updatedAt],
    ["/sports", sports.updatedAt],
    ["/news", news.updatedAt],
    ["/tech", tech.updatedAt],
    ["/video", maxDate([video.updatedAt, videoShorts.updatedAt])],
    ["/games", games.updatedAt],
    ["/gallery", gallery.updatedAt],
  ]);

  const dynamicPaths = [
    ...(events.items ?? []).map((item) => {
      const path = `/events/${item.slug}`;
      pathLastmod.set(path, item.updatedAt ?? events.updatedAt);
      return path;
    }),
    ...(topics.items ?? []).map((item) => {
      const path = `/topics/${item.slug}`;
      pathLastmod.set(path, item.updatedAt ?? topics.updatedAt);
      return path;
    }),
  ];

  const paths = [...new Set([...staticPaths, ...dynamicPaths])];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => formatUrl(path, pathLastmod.get(path))),
    "</urlset>",
    "",
  ].join("\n");

  await writeFile(OUTPUT_FILE, xml, "utf8");
  console.log(`Updated public/sitemap.xml with ${paths.length} URLs`);
}

async function readJson(fileUrl) {
  const contents = await readFile(fileUrl, "utf8");
  return JSON.parse(contents);
}

function formatUrl(path, lastmod) {
  if (!lastmod) {
    return `  <url><loc>${SITE_ORIGIN}${path}</loc></url>`;
  }

  return [
    "  <url>",
    `    <loc>${SITE_ORIGIN}${path}</loc>`,
    `    <lastmod>${dateOnly(lastmod)}</lastmod>`,
    "  </url>",
  ].join("\n");
}

function maxDate(values) {
  const timestamps = values
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  return new Date(Math.max(...timestamps)).toISOString();
}

function dateOnly(value) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return new Date().toISOString().slice(0, 10);
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
