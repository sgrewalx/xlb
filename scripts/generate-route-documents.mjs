import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildRouteDefinitions,
  canonicalUrl,
  extractSitemapRoutes,
  SITE_ORIGIN,
} from "./route-definitions.mjs";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const distDirectory = path.resolve(scriptsDirectory, "../dist");
const routeDocumentsDirectory = path.join(distDirectory, "route-documents");
const sitemapPath = path.join(distDirectory, "sitemap.xml");
const indexPath = path.join(distDirectory, "index.html");
const notFoundPath = path.join(distDirectory, "404.html");
const routeManifestPath = path.join(distDirectory, "route-documents.json");
const eventsPath = path.join(distDirectory, "content/live/events.json");
const topicsPath = path.join(distDirectory, "content/topics/index.json");

export async function generateRouteDocuments() {
  const [baseHtml, sitemapXml, eventsFeed, topicsFeed] = await Promise.all([
    readFile(indexPath, "utf8"),
    readFile(sitemapPath, "utf8"),
    readJson(eventsPath),
    readJson(topicsPath),
  ]);
  const routes = buildRouteDefinitions({ eventsFeed, topicsFeed });
  const sitemapRoutes = extractSitemapRoutes(sitemapXml);

  assertMatchingRouteSets(
    sitemapRoutes,
    routes.map((route) => route.path),
    "sitemap and route definitions",
  );

  await rm(routeDocumentsDirectory, { recursive: true, force: true });
  await mkdir(routeDocumentsDirectory, { recursive: true });

  const routeManifest = [];
  for (const route of routes) {
    const html = renderRouteDocument(baseHtml, route);
    const documentPath = route.path === "/"
      ? "index.html"
      : `route-documents/${route.path.slice(1)}.html`;
    const absoluteDocumentPath = path.join(distDirectory, documentPath);
    await mkdir(path.dirname(absoluteDocumentPath), { recursive: true });
    await writeFile(absoluteDocumentPath, html, "utf8");
    routeManifest.push({
      route: route.path,
      documentPath,
      storageKey: route.path === "/" ? "index.html" : route.path.slice(1),
    });
  }

  await writeFile(notFoundPath, renderNotFoundDocument(baseHtml), "utf8");
  await writeFile(routeManifestPath, `${JSON.stringify(routeManifest, null, 2)}\n`, "utf8");

  console.log(`Generated ${routeManifest.length} route-specific documents and 404.html`);
  return routeManifest;
}

export function renderRouteDocument(baseHtml, route) {
  const canonical = canonicalUrl(route.path);
  const structuredData = buildStructuredData(route);
  let html = baseHtml;

  html = replaceElementText(html, "title", route.title);
  html = replaceMetaContent(html, "name", "description", route.description);
  html = replaceMetaContent(html, "name", "robots", "index,follow");
  html = replaceLinkHref(html, "canonical", canonical);
  html = replaceMetaContent(html, "property", "og:type", route.ogType);
  html = replaceMetaContent(html, "property", "og:title", route.title);
  html = replaceMetaContent(html, "property", "og:description", route.description);
  html = replaceMetaContent(html, "property", "og:url", canonical);
  html = replaceMetaContent(html, "property", "og:image", canonicalUrl(route.imagePath));
  html = replaceMetaContent(html, "name", "twitter:title", route.title);
  html = replaceMetaContent(html, "name", "twitter:description", route.description);
  html = replaceMetaContent(html, "name", "twitter:image", canonicalUrl(route.imagePath));
  html = replaceStructuredData(html, structuredData);
  html = replaceRoot(html, renderStaticRouteMarkup(route));

  return html;
}

export function renderNotFoundDocument(baseHtml) {
  const route = {
    path: "/404",
    title: "Not found | XLB",
    description: "The requested XLB page is not available.",
    eyebrow: "404",
    h1: "Page not found",
    intro: "The requested route or content entity does not exist. Use a verified route below.",
    kind: "webpage",
    ogType: "website",
    imagePath: "/og-image.svg",
    links: [
      { label: "Return home", href: "/" },
      { label: "Browse live streams", href: "/live" },
      { label: "Watch videos", href: "/video" },
    ],
  };
  let html = renderRouteDocument(baseHtml, route);
  html = replaceMetaContent(html, "name", "robots", "noindex,follow");
  return html;
}

function renderStaticRouteMarkup(route) {
  const primaryLinks = [
    { label: "Live", href: "/live" },
    { label: "Video", href: "/video" },
    { label: "Games", href: "/games" },
    { label: "Gallery", href: "/gallery" },
    { label: "Sports", href: "/sports" },
    { label: "News", href: "/news" },
    { label: "Tech", href: "/tech" },
  ];
  const footerLinks = [
    { label: "About", href: "/about" },
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
    { label: "Contact", href: "/contact" },
    { label: "Advertise", href: "/advertise" },
  ];
  const contextLines = [];
  if (route.sourceName) {
    contextLines.push(`<p>Primary source: ${escapeHtml(route.sourceName)}</p>`);
  }
  if (route.updatedAt) {
    contextLines.push(`<p>Updated: ${escapeHtml(formatDate(route.updatedAt))}</p>`);
  }

  return [
    '<div class="site-shell static-route-shell">',
    '  <header class="site-header">',
    '    <div class="brand-row">',
    '      <a class="brand-mark" href="/" aria-label="XLB home"><span>XLB</span></a>',
    `      <nav class="site-nav" aria-label="Primary">${renderLinks(primaryLinks)}</nav>`,
    "    </div>",
    "  </header>",
    '  <main class="page-shell">',
    '    <section class="static-hero static-route-hero">',
    `      <p class="section-eyebrow">${escapeHtml(route.eyebrow)}</p>`,
    `      <h1>${escapeHtml(route.h1)}</h1>`,
    `      <p>${escapeHtml(route.intro)}</p>`,
    ...contextLines.map((line) => `      ${line}`),
    '      <nav class="static-route-links" aria-label="Related pages">',
    `        ${renderLinks(route.links)}`,
    "      </nav>",
    "    </section>",
    "  </main>",
    '  <footer class="site-footer">',
    '    <div><p class="footer-brand">XLB</p><p>Source-backed live events and watch destinations.</p></div>',
    `    <nav class="footer-links" aria-label="Footer">${renderLinks(footerLinks)}</nav>`,
    "  </footer>",
    "</div>",
  ].join("\n");
}

function buildStructuredData(route) {
  const canonical = canonicalUrl(route.path);
  const breadcrumbItems = buildBreadcrumbItems(route);

  if (route.kind === "home") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": `${SITE_ORIGIN}/#website`,
          url: `${SITE_ORIGIN}/`,
          name: "XLB",
          description: route.description,
          publisher: {
            "@type": "Organization",
            name: "CodeMachine",
          },
        },
        {
          "@type": "WebPage",
          "@id": `${canonical}#webpage`,
          url: canonical,
          name: route.title,
          description: route.description,
          isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
        },
      ],
    };
  }

  const page = {
    "@type": route.kind === "collection" || route.kind === "topic"
      ? "CollectionPage"
      : "WebPage",
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: route.title,
    description: route.description,
    isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
    breadcrumb: { "@id": `${canonical}#breadcrumb` },
  };
  if (route.updatedAt) {
    page.dateModified = route.updatedAt;
  }
  if (route.kind === "event" || route.kind === "topic") {
    page.about = {
      "@type": "Thing",
      name: route.h1,
      description: route.description,
    };
  }

  return {
    "@context": "https://schema.org",
    "@graph": [
      page,
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: breadcrumbItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: canonicalUrl(item.path),
        })),
      },
    ],
  };
}

function buildBreadcrumbItems(route) {
  if (route.path === "/") {
    return [{ name: "Home", path: "/" }];
  }

  const items = [{ name: "Home", path: "/" }];
  if (route.path.startsWith("/events/")) {
    items.push({ name: "Live", path: "/live" });
  } else if (route.path.startsWith("/topics/")) {
    items.push({ name: "Live", path: "/live" });
  } else if (route.path.startsWith("/live/")) {
    items.push({ name: "Live", path: "/live" });
  }
  items.push({ name: route.h1, path: route.path });
  return items;
}

function renderLinks(links) {
  return links
    .map((link) => `<a href="${escapeAttribute(link.href)}">${escapeHtml(link.label)}</a>`)
    .join("\n        ");
}

function replaceElementText(html, tagName, value) {
  const pattern = new RegExp(`<${tagName}>[\\s\\S]*?<\\/${tagName}>`, "i");
  return replaceRequired(html, pattern, `<${tagName}>${escapeHtml(value)}</${tagName}>`, tagName);
}

function replaceMetaContent(html, attributeName, attributeValue, content) {
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\b${escapeRegExp(attributeName)}=["']${escapeRegExp(attributeValue)}["'])[^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`Missing meta ${attributeName}=${attributeValue}`);
  }
  return html.replace(pattern, setTagAttribute(match[0], "content", content));
}

function replaceLinkHref(html, rel, href) {
  const pattern = new RegExp(
    `<link\\b(?=[^>]*\\brel=["']${escapeRegExp(rel)}["'])[^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  if (!match) {
    throw new Error(`Missing link rel=${rel}`);
  }
  return html.replace(pattern, setTagAttribute(match[0], "href", href));
}

function replaceStructuredData(html, value) {
  const pattern = /<script\s+type=["']application\/ld\+json["']>[\s\S]*?<\/script>/i;
  const json = JSON.stringify(value, null, 2).replaceAll("<", "\\u003c");
  return replaceRequired(
    html,
    pattern,
    `<script type="application/ld+json">\n${json}\n    </script>`,
    "structured data",
  );
}

function replaceRoot(html, markup) {
  return replaceRequired(
    html,
    /<div\s+id=["']root["']>\s*<\/div>/i,
    `<div id="root">\n${markup}\n    </div>`,
    "root element",
  );
}

function setTagAttribute(tag, attributeName, value) {
  const pattern = new RegExp(`\\b${escapeRegExp(attributeName)}=["'][^"']*["']`, "i");
  if (!pattern.test(tag)) {
    throw new Error(`Missing ${attributeName} attribute in ${tag}`);
  }
  return tag.replace(pattern, `${attributeName}="${escapeAttribute(value)}"`);
}

function replaceRequired(html, pattern, replacement, label) {
  if (!pattern.test(html)) {
    throw new Error(`Missing ${label} in Vite HTML template`);
  }
  return html.replace(pattern, replacement);
}

function assertMatchingRouteSets(left, right, label) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const missingFromRight = [...leftSet].filter((item) => !rightSet.has(item));
  const missingFromLeft = [...rightSet].filter((item) => !leftSet.has(item));

  if (missingFromRight.length || missingFromLeft.length) {
    throw new Error(
      `${label} differ: missing from generated [${missingFromRight.join(", ")}]; ` +
      `missing from sitemap [${missingFromLeft.join(", ")}]`,
    );
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function formatDate(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString().replace(".000Z", "Z")
    : String(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateRouteDocuments().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
