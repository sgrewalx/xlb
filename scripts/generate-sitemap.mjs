import { readFile, writeFile } from "node:fs/promises";

const SITE_ORIGIN = "https://xlb.codemachine.in";
const EVENTS_FILE = new URL("../public/content/live/events.json", import.meta.url);
const TOPICS_FILE = new URL("../public/content/topics/index.json", import.meta.url);
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
];

async function main() {
  const events = await readJson(EVENTS_FILE);
  const topics = await readJson(TOPICS_FILE);

  const dynamicPaths = [
    ...(events.items ?? []).map((item) => `/events/${item.slug}`),
    ...(topics.items ?? []).map((item) => `/topics/${item.slug}`),
  ];

  const paths = [...new Set([...staticPaths, ...dynamicPaths])];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map((path) => `  <url><loc>${SITE_ORIGIN}${path}</loc></url>`),
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
