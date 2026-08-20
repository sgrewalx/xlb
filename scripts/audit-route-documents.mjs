import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildRouteDefinitions,
  canonicalUrl,
  extractSitemapRoutes,
} from "./route-definitions.mjs";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, "..");
const distDirectory = path.join(projectRoot, "dist");
const manifestPath = path.join(distDirectory, "route-documents.json");
const sitemapPath = path.join(distDirectory, "sitemap.xml");
const eventsPath = path.join(distDirectory, "content/live/events.json");
const topicsPath = path.join(distDirectory, "content/topics/index.json");
const notFoundPath = path.join(distDirectory, "404.html");
const unknownPath = "/this-route-should-not-exist-xlb-audit";
const missingEntityPaths = [
  "/events/this-event-does-not-exist",
  "/topics/this-topic-does-not-exist",
];

export async function auditRouteDocuments() {
  const [manifest, sitemapXml, eventsFeed, topicsFeed, notFoundHtml] = await Promise.all([
    readJson(manifestPath),
    readFile(sitemapPath, "utf8"),
    readJson(eventsPath),
    readJson(topicsPath),
    readFile(notFoundPath, "utf8"),
  ]);
  const expectedRoutes = buildRouteDefinitions({ eventsFeed, topicsFeed });
  const expectedByPath = new Map(expectedRoutes.map((route) => [route.path, route]));
  const sitemapRoutes = extractSitemapRoutes(sitemapXml);
  const manifestByRoute = new Map(manifest.map((item) => [item.route, item]));
  const routeSet = new Set(sitemapRoutes);
  const errors = [];
  const routeResults = [];

  for (const routePath of sitemapRoutes) {
    const manifestEntry = manifestByRoute.get(routePath);
    const expected = expectedByPath.get(routePath);
    if (!manifestEntry) {
      errors.push(`${routePath}: no route document manifest entry`);
      continue;
    }
    if (!expected) {
      errors.push(`${routePath}: no expected route definition`);
      continue;
    }

    const absoluteDocumentPath = path.join(distDirectory, manifestEntry.documentPath);
    const html = await readFile(absoluteDocumentPath, "utf8");
    const result = inspectHtml({
      html,
      routePath,
      documentPath: manifestEntry.documentPath,
      routeSet,
    });
    routeResults.push(result);

    if (result.title !== expected.title) {
      errors.push(`${routePath}: title mismatch`);
    }
    if (result.description !== expected.description) {
      errors.push(`${routePath}: description mismatch`);
    }
    if (result.canonical !== canonicalUrl(routePath)) {
      errors.push(`${routePath}: canonical mismatch (${result.canonical})`);
    }
    if (routePath !== "/" && result.canonical === canonicalUrl("/")) {
      errors.push(`${routePath}: non-home route canonicalizes to homepage`);
    }
    if (result.robots !== "index,follow") {
      errors.push(`${routePath}: robots must be index,follow`);
    }
    if (result.h1 !== expected.h1) {
      errors.push(`${routePath}: H1 mismatch`);
    }
    if (result.visibleTextLength < 120) {
      errors.push(`${routePath}: visible text is too thin (${result.visibleTextLength})`);
    }
    if (result.internalLinkCount < 3) {
      errors.push(`${routePath}: fewer than 3 crawlable internal links`);
    }
    if (result.structuredDataCount < 1 || !result.structuredDataValid) {
      errors.push(`${routePath}: structured data missing or invalid`);
    }
    if (result.openGraph.title !== expected.title ||
        result.openGraph.description !== expected.description ||
        result.openGraph.url !== canonicalUrl(routePath)) {
      errors.push(`${routePath}: Open Graph metadata mismatch`);
    }
  }

  const expectedPaths = new Set(expectedRoutes.map((route) => route.path));
  reportSetDifferences("sitemap", new Set(sitemapRoutes), "expected", expectedPaths, errors);
  reportSetDifferences("manifest", new Set(manifestByRoute.keys()), "sitemap", routeSet, errors);

  const uniqueHashes = new Set(routeResults.map((route) => route.bodySha256));
  if (routeResults.length > 1 && uniqueHashes.size === 1) {
    errors.push("all known routes have the same HTML body hash");
  }

  const notFound = inspectHtml({
    html: notFoundHtml,
    routePath: "/404",
    documentPath: "404.html",
    routeSet,
  });
  if (notFound.robots !== "noindex,follow") {
    errors.push("404.html must contain noindex,follow");
  }
  if (notFound.h1 !== "Page not found") {
    errors.push("404.html must contain a clear Page not found H1");
  }
  if (manifestByRoute.has(unknownPath)) {
    errors.push("deliberately unknown route unexpectedly has a generated document");
  }

  const httpResults = await auditHttpContract(manifestByRoute);
  for (const route of httpResults.routes) {
    if (route.status !== 200) {
      errors.push(`${route.path}: local static HTTP contract returned ${route.status}`);
    }
  }
  if (httpResults.unknown.status !== 404 || httpResults.unknown.robots !== "noindex,follow") {
    errors.push("deliberately unknown route did not return HTTP 404 with noindex");
  }
  for (const missingEntity of httpResults.missingEntities) {
    if (missingEntity.status !== 404 || missingEntity.robots !== "noindex,follow") {
      errors.push(`${missingEntity.path}: missing entity did not return HTTP 404 with noindex`);
    }
  }

  if (errors.length) {
    throw new Error(`Route document audit failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    sitemapRouteCount: sitemapRoutes.length,
    generatedRouteCount: manifest.length,
    uniqueBodyHashCount: uniqueHashes.size,
    routes: routeResults.map((route) => ({
      ...route,
      httpStatus: 200,
    })),
    unknownRoute: {
      path: unknownPath,
      documentPath: "404.html",
      httpStatus: httpResults.unknown.status,
      robots: httpResults.unknown.robots,
      h1: notFound.h1,
      canonical: notFound.canonical,
      bodySha256: notFound.bodySha256,
    },
    missingEntityRoutes: httpResults.missingEntities,
  };
}

function inspectHtml({ html, routePath, documentPath, routeSet }) {
  const internalLinks = [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((href) => routeSet.has(href));
  const structuredData = [...html.matchAll(
    /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi,
  )];
  let structuredDataValid = structuredData.length > 0;
  for (const match of structuredData) {
    try {
      JSON.parse(match[1]);
    } catch {
      structuredDataValid = false;
    }
  }

  const visibleText = decodeHtml(
    html
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  return {
    path: routePath,
    documentPath,
    title: extractElementText(html, "title"),
    canonical: extractLinkHref(html, "canonical"),
    description: extractMetaContent(html, "name", "description"),
    robots: extractMetaContent(html, "name", "robots"),
    h1: extractElementText(html, "h1"),
    visibleTextLength: visibleText.length,
    internalLinkCount: new Set(internalLinks).size,
    internalLinks: [...new Set(internalLinks)],
    openGraph: {
      type: extractMetaContent(html, "property", "og:type"),
      title: extractMetaContent(html, "property", "og:title"),
      description: extractMetaContent(html, "property", "og:description"),
      url: extractMetaContent(html, "property", "og:url"),
      image: extractMetaContent(html, "property", "og:image"),
    },
    structuredDataCount: structuredData.length,
    structuredDataValid,
    bodySha256: createHash("sha256").update(html).digest("hex"),
  };
}

async function auditHttpContract(manifestByRoute) {
  const server = createServer(async (request, response) => {
    try {
      const requestPath = new URL(request.url, "http://localhost").pathname;
      const manifestEntry = manifestByRoute.get(requestPath);
      const documentPath = manifestEntry?.documentPath ?? "404.html";
      const status = manifestEntry ? 200 : 404;
      const html = await readFile(path.join(distDirectory, documentPath), "utf8");
      response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  try {
    const address = server.address();
    const origin = `http://127.0.0.1:${address.port}`;
    const routes = [];
    for (const routePath of manifestByRoute.keys()) {
      const response = await fetch(`${origin}${routePath}`);
      routes.push({ path: routePath, status: response.status });
    }
    const unknownResponse = await fetch(`${origin}${unknownPath}`);
    const unknownHtml = await unknownResponse.text();
    const missingEntities = [];
    for (const missingEntityPath of missingEntityPaths) {
      const response = await fetch(`${origin}${missingEntityPath}`);
      const html = await response.text();
      missingEntities.push({
        path: missingEntityPath,
        status: response.status,
        robots: extractMetaContent(html, "name", "robots"),
      });
    }
    return {
      routes,
      unknown: {
        status: unknownResponse.status,
        robots: extractMetaContent(unknownHtml, "name", "robots"),
      },
      missingEntities,
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function extractElementText(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeHtml(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()) : "";
}

function extractMetaContent(html, attributeName, attributeValue) {
  const tag = html.match(new RegExp(
    `<meta\\b(?=[^>]*\\b${escapeRegExp(attributeName)}=["']${escapeRegExp(attributeValue)}["'])[^>]*>`,
    "i",
  ))?.[0];
  return tag ? extractAttribute(tag, "content") : "";
}

function extractLinkHref(html, rel) {
  const tag = html.match(new RegExp(
    `<link\\b(?=[^>]*\\brel=["']${escapeRegExp(rel)}["'])[^>]*>`,
    "i",
  ))?.[0];
  return tag ? extractAttribute(tag, "href") : "";
}

function extractAttribute(tag, attributeName) {
  const match = tag.match(new RegExp(`\\b${escapeRegExp(attributeName)}=["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function reportSetDifferences(leftLabel, left, rightLabel, right, errors) {
  for (const value of left) {
    if (!right.has(value)) {
      errors.push(`${leftLabel} contains ${value}, missing from ${rightLabel}`);
    }
  }
  for (const value of right) {
    if (!left.has(value)) {
      errors.push(`${rightLabel} contains ${value}, missing from ${leftLabel}`);
    }
  }
}

function decodeHtml(value) {
  return String(value)
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function main() {
  const result = await auditRouteDocuments();
  const outputArgumentIndex = process.argv.indexOf("--output");
  if (outputArgumentIndex !== -1) {
    const requestedPath = process.argv[outputArgumentIndex + 1];
    if (!requestedPath) {
      throw new Error("--output requires a path");
    }
    const absoluteOutputPath = path.resolve(projectRoot, requestedPath);
    await mkdir(path.dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(`Wrote ${absoluteOutputPath}`);
  }
  console.log(
    `audited ${result.generatedRouteCount} route documents with ` +
    `${result.uniqueBodyHashCount} unique body hashes; unknown and missing entities returned 404`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
