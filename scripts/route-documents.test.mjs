import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildRouteDefinitions,
  canonicalUrl,
} from "./route-definitions.mjs";
import { renderNotFoundDocument, renderRouteDocument } from "./generate-route-documents.mjs";
import {
  collectInternalReferences,
  validateRouteConsistency,
} from "./validate-routes.mjs";

const eventsFeed = {
  updatedAt: "2026-07-28T00:00:00.000Z",
  items: [
    {
      slug: "test-launch",
      title: "Test launch",
      summary: "A source-backed test launch used to verify static route generation.",
      status: "upcoming",
      category: "space",
      topic: "launches",
      sourceName: "Test source",
      updatedAt: "2026-07-28T00:00:00.000Z",
    },
  ],
};

const topicsFeed = {
  updatedAt: "2026-07-28T00:00:00.000Z",
  items: [
    {
      slug: "launches",
      title: "Launches",
      category: "space",
      summary: "Source-backed launch monitoring and related live coverage.",
      updatedAt: "2026-07-28T00:00:00.000Z",
    },
  ],
};

test("route definitions include only existing dynamic entities", () => {
  const routes = buildRouteDefinitions({ eventsFeed, topicsFeed });
  const paths = new Set(routes.map((route) => route.path));

  assert.equal(routes.length, 17);
  assert.ok(paths.has("/events/test-launch"));
  assert.ok(paths.has("/topics/launches"));
  assert.ok(!paths.has("/events/missing-event"));
  assert.ok(!paths.has("/topics/missing-topic"));
  assert.equal(paths.size, routes.length);
});

test("route HTML contains route-specific pre-render metadata and content", async () => {
  const baseHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const route = buildRouteDefinitions({ eventsFeed, topicsFeed })
    .find((candidate) => candidate.path === "/events/test-launch");
  const html = renderRouteDocument(baseHtml, route);

  assert.match(html, /<title>Test launch \| XLB<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/xlb\.codemachine\.in\/events\/test-launch"/);
  assert.match(html, /<h1>Test launch<\/h1>/);
  assert.match(html, /href="\/topics\/launches"/);
  assert.match(html, /property="og:url" content="https:\/\/xlb\.codemachine\.in\/events\/test-launch"/);
  assert.match(html, /"@type": "Thing"/);
  assert.doesNotMatch(html, /<div id="root"><\/div>/);
});

test("404 document is noindex and carries a clear H1", async () => {
  const baseHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const html = renderNotFoundDocument(baseHtml);

  assert.match(html, /content="noindex,follow"/);
  assert.match(html, /<h1>Page not found<\/h1>/);
  assert.match(html, /rel="canonical" href="https:\/\/xlb\.codemachine\.in\/404"/);
});

test("route consistency accepts valid manifest targets", () => {
  const routes = buildRouteDefinitions({ eventsFeed, topicsFeed });
  const sitemapRoutes = routes.map((route) => route.path);
  const manifests = [
    { relativePath: "live/events.json", value: eventsFeed },
    { relativePath: "topics/index.json", value: topicsFeed },
    {
      relativePath: "live/scoreboard.json",
      value: {
        items: [
          {
            slug: "test-launch",
            pagePath: "/events/test-launch",
          },
        ],
      },
    },
    {
      relativePath: "home/modules.json",
      value: {
        items: [{ ctaUrl: "/live", href: "/events/test-launch" }],
      },
    },
  ];

  const result = validateRouteConsistency({
    routes,
    sitemapRoutes,
    manifests,
    eventsFeed,
    topicsFeed,
  });

  assert.equal(result.routeCount, sitemapRoutes.length);
  assert.equal(result.internalReferenceCount, 3);
});

test("route consistency rejects a missing internal target", () => {
  const routes = buildRouteDefinitions({ eventsFeed, topicsFeed });
  assert.throws(
    () => validateRouteConsistency({
      routes,
      sitemapRoutes: routes.map((route) => route.path),
      manifests: [
        { relativePath: "live/events.json", value: eventsFeed },
        { relativePath: "topics/index.json", value: topicsFeed },
        {
          relativePath: "video/shorts.json",
          value: { items: [{ relatedPath: "/events/missing-event" }] },
        },
      ],
      eventsFeed,
      topicsFeed,
    }),
    /internal target \/events\/missing-event is not generated/,
  );
});

test("internal reference collector ignores public asset paths", () => {
  const references = collectInternalReferences({
    image: "/media/modules/satellites.svg",
    content: "/content/live/events.json",
    target: "/live/space",
  });

  assert.deepEqual(references, [{ jsonPath: "$.target", value: "/live/space" }]);
  assert.equal(canonicalUrl("/live"), "https://xlb.codemachine.in/live");
});
