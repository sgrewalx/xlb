import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildRouteDefinitions,
  extractSitemapRoutes,
} from "./route-definitions.mjs";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, "..");
const contentDirectory = path.join(projectRoot, "public/content");
const sitemapPath = path.join(projectRoot, "public/sitemap.xml");
const deletedClpsSlug = ["clps-flight", "astrobotic", "griffin-1"].join("-");
const nonRoutePrefixes = ["/assets/", "/content/", "/media/"];

export function validateRouteConsistency({
  routes,
  sitemapRoutes,
  manifests,
  eventsFeed,
  topicsFeed,
}) {
  const errors = [];
  const routePaths = routes.map((route) => route.path);
  const routeSet = new Set(routePaths);
  const sitemapSet = new Set(sitemapRoutes);

  reportDuplicates(routePaths, "generated route", errors);
  reportDuplicates(sitemapRoutes, "sitemap route", errors);

  for (const route of routes) {
    for (const field of ["path", "title", "description", "h1", "intro", "kind", "ogType"]) {
      if (typeof route[field] !== "string" || !route[field].trim()) {
        errors.push(`${route.path || "(unknown route)"}: ${field} is required`);
      }
    }
    if (!Array.isArray(route.links) || route.links.length === 0) {
      errors.push(`${route.path}: at least one related internal link is required`);
    }
    for (const link of route.links ?? []) {
      if (!routeSet.has(link.href)) {
        errors.push(`${route.path}: route link ${link.href} is not generated`);
      }
    }
  }

  for (const routePath of sitemapSet) {
    if (!routeSet.has(routePath)) {
      errors.push(`sitemap route ${routePath} has no generated route definition`);
    }
  }
  for (const routePath of routeSet) {
    if (!sitemapSet.has(routePath)) {
      errors.push(`generated route ${routePath} is missing from sitemap`);
    }
  }

  const eventSlugList = (eventsFeed?.items ?? []).map((item) => item.slug);
  const topicSlugList = (topicsFeed?.items ?? []).map((item) => item.slug);
  const eventSlugs = new Set(eventSlugList);
  const topicSlugs = new Set(topicSlugList);
  reportDuplicates(eventSlugList, "event slug", errors);
  reportDuplicates(topicSlugList, "topic slug", errors);

  for (const event of eventsFeed?.items ?? []) {
    if (!topicSlugs.has(event.topic)) {
      errors.push(`event ${event.slug} references missing topic ${event.topic}`);
    }
    if (!routeSet.has(`/events/${event.slug}`)) {
      errors.push(`event ${event.slug} has no generated route`);
    }
  }
  for (const topic of topicsFeed?.items ?? []) {
    if (!routeSet.has(`/topics/${topic.slug}`)) {
      errors.push(`topic ${topic.slug} has no generated route`);
    }
  }

  let referenceCount = 0;
  for (const manifest of manifests) {
    const references = collectInternalReferences(manifest.value);
    referenceCount += references.length;
    for (const reference of references) {
      if (!routeSet.has(reference.value)) {
        errors.push(
          `${manifest.relativePath}${reference.jsonPath}: internal target ` +
          `${reference.value} is not generated`,
        );
      }
    }
    const deletedReferences = collectMatchingStrings(manifest.value, deletedClpsSlug);
    for (const reference of deletedReferences) {
      errors.push(
        `${manifest.relativePath}${reference.jsonPath}: deleted CLPS reference remains`,
      );
    }
  }

  const scoreboard = manifests.find(
    (manifest) => manifest.relativePath === "live/scoreboard.json",
  )?.value;
  for (const item of scoreboard?.items ?? []) {
    if (!eventSlugs.has(item.slug)) {
      errors.push(`live/scoreboard.json: scoreboard slug ${item.slug} has no event entity`);
    }
    if (item.pagePath !== `/events/${item.slug}`) {
      errors.push(
        `live/scoreboard.json: ${item.slug} pagePath does not match its event route`,
      );
    }
  }

  if (routes.length !== sitemapRoutes.length) {
    errors.push(
      `route count ${routes.length} does not match sitemap count ${sitemapRoutes.length}`,
    );
  }

  if (errors.length) {
    throw new Error(`Route consistency validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    routeCount: routes.length,
    sitemapCount: sitemapRoutes.length,
    manifestCount: manifests.length,
    internalReferenceCount: referenceCount,
  };
}

export function collectInternalReferences(value, jsonPath = "$", output = []) {
  if (typeof value === "string") {
    if (
      value.startsWith("/") &&
      !nonRoutePrefixes.some((prefix) => value.startsWith(prefix))
    ) {
      output.push({ jsonPath, value });
    }
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectInternalReferences(item, `${jsonPath}[${index}]`, output);
    });
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectInternalReferences(child, `${jsonPath}.${key}`, output);
    }
  }
  return output;
}

function collectMatchingStrings(value, needle, jsonPath = "$", output = []) {
  if (typeof value === "string") {
    if (value.includes(needle)) {
      output.push({ jsonPath, value });
    }
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectMatchingStrings(item, needle, `${jsonPath}[${index}]`, output);
    });
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectMatchingStrings(child, needle, `${jsonPath}.${key}`, output);
    }
  }
  return output;
}

function reportDuplicates(values, label, errors) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      errors.push(`duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

async function loadManifests() {
  const files = await listJsonFiles(contentDirectory);
  return Promise.all(files.map(async (absolutePath) => ({
    relativePath: path.relative(contentDirectory, absolutePath).split(path.sep).join("/"),
    value: JSON.parse(await readFile(absolutePath, "utf8")),
  })));
}

async function listJsonFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listJsonFiles(absolutePath));
    } else if (entry.name.endsWith(".json")) {
      files.push(absolutePath);
    }
  }
  return files.sort();
}

async function main() {
  const [sitemapXml, manifests] = await Promise.all([
    readFile(sitemapPath, "utf8"),
    loadManifests(),
  ]);
  const eventsFeed = manifests.find(
    (manifest) => manifest.relativePath === "live/events.json",
  )?.value;
  const topicsFeed = manifests.find(
    (manifest) => manifest.relativePath === "topics/index.json",
  )?.value;
  const routes = buildRouteDefinitions({ eventsFeed, topicsFeed });
  const result = validateRouteConsistency({
    routes,
    sitemapRoutes: extractSitemapRoutes(sitemapXml),
    manifests,
    eventsFeed,
    topicsFeed,
  });

  console.log(
    `validated ${result.routeCount} routes, ${result.sitemapCount} sitemap URLs, ` +
    `${result.internalReferenceCount} internal manifest targets`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
