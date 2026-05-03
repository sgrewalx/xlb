import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAutonomyState,
  buildHomeModules,
  buildPruneReport,
  buildVideoShorts,
} from "./shared.mjs";

function makeContext(overrides = {}) {
  return {
    updatedAt: "2026-05-03T09:00:00.000Z",
    snapshotFile: "/tmp/merged-2026-05-03.json",
    snapshot: {
      capturedAt: "2026-05-03T09:00:00.000Z",
      sources: {
        ga4: true,
        searchConsole: true,
      },
      pages: [
        {
          path: "/",
          pageviews: 9,
          searchImpressions: 5,
          engagementScore: 100,
          returnVisitors: 2,
        },
        {
          path: "/video",
          pageviews: 15,
          searchImpressions: 0,
          engagementScore: 100,
          videoStarts: 4,
        },
        {
          path: "/live",
          pageviews: 7,
          searchImpressions: 0,
          engagementScore: 100,
        },
        {
          path: "/events/aurora-watch",
          pageviews: 8,
          searchImpressions: 0,
          engagementScore: 100,
        },
      ],
    },
    pageMap: new Map([
      ["/", { path: "/", pageviews: 9, searchImpressions: 5, engagementScore: 100, returnVisitors: 2 }],
      ["/video", { path: "/video", pageviews: 15, searchImpressions: 0, engagementScore: 100, videoStarts: 4 }],
      ["/live", { path: "/live", pageviews: 7, searchImpressions: 0, engagementScore: 100 }],
      ["/events/aurora-watch", { path: "/events/aurora-watch", pageviews: 8, searchImpressions: 0, engagementScore: 100 }],
      ["/games", { path: "/games", pageviews: 2, searchImpressions: 1, engagementScore: 71, gameStarts: 1 }],
      ["/gallery", { path: "/gallery", pageviews: 2, searchImpressions: 3, engagementScore: 71, galleryOpens: 1 }],
      ["/live/earth", { path: "/live/earth", pageviews: 4, searchImpressions: 0, engagementScore: 75 }],
      ["/live/space", { path: "/live/space", pageviews: 3, searchImpressions: 0, engagementScore: 74 }],
    ]),
    liveEventsFeed: {
      updatedAt: "2026-05-03T09:00:00.000Z",
      items: [
        {
          id: "earthquake",
          slug: "global-earthquake-watch",
          title: "Global earthquake watch",
          status: "monitoring",
          category: "earth",
          topic: "earthquakes",
          startsAt: "2026-05-03T08:00:00.000Z",
          summary: "Earthquake monitoring summary.",
          sourceName: "USGS",
          sourceUrl: "https://example.com/usgs",
          watchUrl: "https://example.com/usgs",
          coverageMode: "link",
          safeToPromote: true,
          heroPriority: 98,
          importance: 95,
          updatedAt: "2026-05-03T09:00:00.000Z",
        },
        {
          id: "aurora",
          slug: "aurora-watch",
          title: "Aurora watch",
          status: "monitoring",
          category: "space",
          topic: "space-weather",
          startsAt: "2026-05-03T07:00:00.000Z",
          summary: "Aurora monitoring summary.",
          sourceName: "NOAA",
          sourceUrl: "https://example.com/noaa",
          watchUrl: "https://example.com/noaa",
          coverageMode: "link",
          safeToPromote: true,
          heroPriority: 96,
          importance: 94,
          updatedAt: "2026-05-03T09:00:00.000Z",
        },
        {
          id: "launch",
          slug: "nasa-launch",
          title: "NASA launch",
          status: "upcoming",
          category: "space",
          topic: "launches",
          startsAt: "2026-05-03T18:00:00.000Z",
          summary: "Launch summary.",
          sourceName: "NASA",
          sourceUrl: "https://example.com/nasa",
          watchUrl: "https://example.com/nasa",
          coverageMode: "link",
          safeToPromote: true,
          heroPriority: 88,
          importance: 86,
          updatedAt: "2026-05-03T09:00:00.000Z",
        },
      ],
    },
    scoreboard: {
      updatedAt: "2026-05-03T09:00:00.000Z",
      items: [
        { slug: "global-earthquake-watch", pagePath: "/events/global-earthquake-watch", category: "earth", score: 82, pageviews: 2, searchImpressions: 0, engagementScore: 100, recommendation: "expand" },
        { slug: "aurora-watch", pagePath: "/events/aurora-watch", category: "space", score: 82, pageviews: 8, searchImpressions: 0, engagementScore: 100, recommendation: "expand" },
        { slug: "nasa-launch", pagePath: "/events/nasa-launch", category: "space", score: 75, pageviews: 1, searchImpressions: 0, engagementScore: 80, recommendation: "hold" },
      ],
    },
    topicsFeed: {
      updatedAt: "2026-05-03T09:00:00.000Z",
      items: [
        { slug: "space-weather", title: "Space Weather", category: "space", summary: "Topic summary", eventCount: 1, promotedEventCount: 1, bestScore: 82, recommendation: "expand", updatedAt: "2026-05-03T09:00:00.000Z" },
        { slug: "earthquakes", title: "Earthquakes", category: "earth", summary: "Topic summary", eventCount: 1, promotedEventCount: 1, bestScore: 82, recommendation: "expand", updatedAt: "2026-05-03T09:00:00.000Z" },
      ],
    },
    videoFeed: {
      updatedAt: "2026-05-03T09:00:00.000Z",
      items: [
        {
          id: "fresh-short",
          title: "Aurora watch shorts",
          source: "YouTube - A",
          url: "https://www.youtube.com/shorts/abc123",
          embedUrl: "https://www.youtube.com/embed/abc123",
          publishedAt: "2026-05-03T08:30:00.000Z",
          summary: "Fresh short linked to aurora watch.",
        },
        {
          id: "older-video",
          title: "Old launch explainer",
          source: "YouTube - A",
          url: "https://www.youtube.com/watch?v=def456",
          embedUrl: "https://www.youtube.com/embed/def456",
          publishedAt: "2026-04-01T08:30:00.000Z",
          summary: "Older launch clip.",
        },
      ],
    },
    newsFeed: { updatedAt: "2026-05-03T09:00:00.000Z", items: [{ id: "n1", title: "News item", source: "News", url: "https://example.com", tag: "News", publishedAt: "2026-05-03T09:00:00.000Z", summary: "summary" }] },
    sportsFeed: { updatedAt: "2026-05-03T09:00:00.000Z", items: [{ id: "s1", title: "Sports item", source: "Sports", url: "https://example.com", tag: "Sports", publishedAt: "2026-05-03T09:00:00.000Z", summary: "summary" }] },
    techFeed: { updatedAt: "2026-05-03T09:00:00.000Z", items: [{ id: "t1", title: "Tech item", source: "Tech", url: "https://example.com", tag: "Tech", publishedAt: "2026-05-03T09:00:00.000Z", summary: "summary" }] },
    ...overrides,
  };
}

test("buildVideoShorts favors fresher shorts over stale videos", () => {
  const context = makeContext();
  const feed = buildVideoShorts(context);

  assert.equal(feed.items[0].id, "fresh-short");
  assert.equal(feed.items[0].isShort, true);
  assert.ok(feed.items[0].retentionScore > feed.items[1].retentionScore);
});

test("buildHomeModules returns the three primary acquisition modules", () => {
  const context = makeContext();
  const feed = buildHomeModules(context);

  assert.deepEqual(feed.items.map((item) => item.kind), [
    "happening_now",
    "next_24_hours",
    "why_people_check",
  ]);
  assert.equal(feed.items[0].items[0].href, "/events/aurora-watch");
});

test("buildAutonomyState and prune report reflect active signals and stale items", () => {
  const context = makeContext({
    liveEventsFeed: {
      updatedAt: "2026-05-03T09:00:00.000Z",
      items: [
        ...makeContext().liveEventsFeed.items,
        {
          id: "ended-launch",
          slug: "old-launch",
          title: "Old launch",
          status: "ended",
          category: "space",
          topic: "launches",
          startsAt: "2026-04-20T08:00:00.000Z",
          summary: "Old launch summary.",
          sourceName: "NASA",
          sourceUrl: "https://example.com/nasa-old",
          watchUrl: "https://example.com/nasa-old",
          coverageMode: "link",
          safeToPromote: true,
          heroPriority: 10,
          importance: 10,
          updatedAt: "2026-05-03T09:00:00.000Z",
        },
      ],
    },
  });
  const home = buildHomeModules(context);
  const video = buildVideoShorts(context);
  const autonomy = buildAutonomyState(context, home, video, { updatedAt: context.updatedAt, items: [] }, { updatedAt: context.updatedAt, items: [] });
  const prune = buildPruneReport(context);

  assert.equal(autonomy.status, "active-learning");
  assert.equal(prune.staleEvents[0].slug, "old-launch");
});
