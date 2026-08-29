import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAutonomyState,
  buildGalleryCollections,
  buildHomeModules,
  buildPruneReport,
  buildVideoShorts,
} from "./shared.mjs";
import { buildGalleryVisuals } from "./gallery-visuals.mjs";

function makeContext(overrides = {}) {
  return {
    now: Date.parse("2026-05-03T09:00:00.000Z"),
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
  assert.equal(feed.items[1].items.length, 1);
  assert.equal(feed.items[1].emptyState, null);
});

test("buildHomeModules models zero upcoming events as an explicit empty state", () => {
  const base = makeContext();
  const context = makeContext({
    liveEventsFeed: {
      ...base.liveEventsFeed,
      items: base.liveEventsFeed.items.filter((item) => item.status !== "upcoming"),
    },
  });

  const next24 = buildHomeModules(context).items.find((item) => item.kind === "next_24_hours");

  assert.deepEqual(next24.items, []);
  assert.deepEqual(next24.emptyState, {
    title: "No scheduled events in the next 24 hours",
    description: "Live monitoring remains active while the next scheduled event is confirmed.",
  });
  assert.equal(next24.metrics[0].value, "0");
});

test("buildHomeModules includes multiple upcoming events inside the next 24 hours", () => {
  const base = makeContext();
  const context = makeContext({
    liveEventsFeed: {
      ...base.liveEventsFeed,
      items: [
        ...base.liveEventsFeed.items,
        {
          ...base.liveEventsFeed.items.find((item) => item.id === "launch"),
          id: "second-launch",
          slug: "second-launch",
          title: "Second launch",
          startsAt: "2026-05-04T08:00:00.000Z",
        },
      ],
    },
  });

  const next24 = buildHomeModules(context).items.find((item) => item.kind === "next_24_hours");

  assert.deepEqual(next24.items.map((item) => item.id), ["launch", "second-launch"]);
  assert.equal(next24.emptyState, null);
  assert.equal(next24.metrics[0].value, "2");
});

test("Gallery collections carry auditable source-backed visual metadata", () => {
  const gallery = buildGalleryCollections(makeContext());

  assert.equal(gallery.items.length, 4);
  for (const collection of gallery.items) {
    assert.match(collection.image, /^\/content\/gallery\/visuals\/[a-z0-9-]+\.svg$/);
    assert.equal(collection.imageOrigin, "generated-official-data");
    assert.equal(collection.visualType, "data-visualization");
    assert.match(collection.imageSourceUrl, /^https:\/\//);

    for (const entry of collection.entries) {
      assert.match(entry.image, /^\/content\/gallery\/visuals\/[a-z0-9-]+\.svg$/);
      assert.equal(entry.imageOrigin, "generated-official-data");
      assert.equal(entry.visualType, "data-visualization");
    }
  }
});

test("Gallery visuals encode current USGS, NOAA, NASA, and topic values", () => {
  const context = makeContext();
  context.liveEventsFeed.items[0].summary =
    "USGS reported 248 earthquake events in the last 24 hours. Strongest reported event: M6 near Somalia.";
  context.liveEventsFeed.items[1].summary =
    "Current geomagnetic conditions are near Kp 2. Recent peak reached Kp 4. NOAA SWPC monitoring remains active.";
  const visuals = new Map(buildGalleryVisuals(context).map((visual) => [visual.id, visual.svg]));

  assert.match(visuals.get("earthquake-activity"), />248<\/text>/);
  assert.match(visuals.get("earthquake-activity"), />M6<\/text>/);
  assert.match(visuals.get("aurora-kp"), /Current Kp 2/);
  assert.match(visuals.get("aurora-kp"), /Recent peak Kp 4/);
  assert.match(visuals.get("launch-timeline"), /NASA launch/);
  assert.match(visuals.get("topic-signals"), /Space Weather/);
});

test("Gallery earthquake visual uses a safe promoted event", () => {
  const context = makeContext();
  context.liveEventsFeed.items[0].summary =
    "USGS reported 314 earthquake events in the last 24 hours. Strongest reported event: M5.5 near Safe Ridge.";

  const svg = galleryVisual(context, "earthquake-activity");

  assert.match(svg, />314<\/text>/);
  assert.match(svg, />M5.5<\/text>/);
});

test("Gallery earthquake visual excludes an unsafe event", () => {
  const context = makeContext();
  context.liveEventsFeed.items[0] = {
    ...context.liveEventsFeed.items[0],
    safeToPromote: false,
    summary: "USGS reported 999 earthquake events in the last 24 hours. Strongest reported event: M9.9 near Unsafe Ridge.",
  };

  const svg = galleryVisual(context, "earthquake-activity");

  assert.match(svg, /No current promoted earthquake signal/);
  assert.doesNotMatch(svg, />999<\/text>|>M9\.9<\/text>|Unsafe Ridge/);
});

test("Gallery earthquake visual prefers the safe event when an unsafe duplicate exists", () => {
  const context = makeContext();
  const safe = {
    ...context.liveEventsFeed.items[0],
    summary: "USGS reported 111 earthquake events in the last 24 hours. Strongest reported event: M4.2 near Safe Ridge.",
  };
  const unsafe = {
    ...safe,
    id: "unsafe-earthquake",
    safeToPromote: false,
    summary: "USGS reported 999 earthquake events in the last 24 hours. Strongest reported event: M9.9 near Unsafe Ridge.",
  };
  context.liveEventsFeed.items = [unsafe, safe, ...context.liveEventsFeed.items.slice(1)];

  const svg = galleryVisual(context, "earthquake-activity");

  assert.match(svg, />111<\/text>/);
  assert.match(svg, />M4.2<\/text>/);
  assert.doesNotMatch(svg, />999<\/text>|>M9\.9<\/text>|Unsafe Ridge/);
});

test("Gallery aurora visual excludes an unsafe event", () => {
  const context = makeContext();
  context.liveEventsFeed.items[1] = {
    ...context.liveEventsFeed.items[1],
    safeToPromote: false,
    summary: "Current geomagnetic conditions are near Kp 9. Recent peak reached Kp 9. Unsafe aurora signal.",
  };

  const svg = galleryVisual(context, "aurora-kp");

  assert.match(svg, /No current promoted aurora signal/);
  assert.doesNotMatch(svg, /Current Kp 9|Recent peak Kp 9|Unsafe aurora signal/);
});

test("Gallery launch timeline excludes unsafe launches", () => {
  const context = makeContext();
  context.liveEventsFeed.items.push({
    ...context.liveEventsFeed.items[2],
    id: "unsafe-launch",
    slug: "unsafe-launch",
    title: "Unsafe classified launch",
    safeToPromote: false,
  });

  const svg = galleryVisual(context, "launch-timeline");

  assert.match(svg, /NASA launch/);
  assert.doesNotMatch(svg, /Unsafe classified launch/);
});

test("Gallery launch timeline renders a neutral state when every launch is unsafe", () => {
  const context = makeContext();
  context.liveEventsFeed.items = context.liveEventsFeed.items.map((item) =>
    item.topic === "launches"
      ? { ...item, title: "Unsafe classified launch", safeToPromote: false }
      : item,
  );

  const svg = galleryVisual(context, "launch-timeline");

  assert.match(svg, /No current promoted launch signal/);
  assert.match(svg, /Awaiting a safe source-backed launch record/);
  assert.doesNotMatch(svg, /Unsafe classified launch/);
});

function galleryVisual(context, id) {
  return buildGalleryVisuals(context).find((visual) => visual.id === id)?.svg ?? "";
}

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
