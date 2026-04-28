import { readFile, writeFile } from "node:fs/promises";

const SITEMAP_FILE = new URL("../dist/sitemap.xml", import.meta.url);
const INDEX_FILE = new URL("../dist/index.html", import.meta.url);
const NOT_FOUND_FILE = new URL("../dist/404.html", import.meta.url);
const ROUTE_MANIFEST_FILE = new URL("../dist/route-documents.json", import.meta.url);

async function main() {
  const [indexHtml, sitemapXml] = await Promise.all([
    readFile(INDEX_FILE, "utf8"),
    readFile(SITEMAP_FILE, "utf8"),
  ]);
  const routes = extractRoutes(sitemapXml);
  const notFoundHtml = indexHtml
    .replace("<title>XLB | Experience Love Bonding</title>", "<title>Not found | XLB</title>")
    .replace('content="index,follow"', 'content="noindex,follow"')
    .replace('href="https://xlb.codemachine.in/"', 'href="https://xlb.codemachine.in/404"');

  await writeFile(NOT_FOUND_FILE, notFoundHtml, "utf8");
  await writeFile(
    ROUTE_MANIFEST_FILE,
    `${JSON.stringify(routes.filter((route) => route !== "/"), null, 2)}\n`,
    "utf8",
  );

  console.log(`Generated ${routes.length - 1} route documents and 404.html`);
}

function extractRoutes(xml) {
  const matches = [...xml.matchAll(/<loc>https:\/\/xlb\.codemachine\.in([^<]*)<\/loc>/g)];
  return [...new Set(matches.map((match) => match[1] || "/"))];
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
