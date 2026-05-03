import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SNAPSHOT_DIR = new URL("../snapshots/", import.meta.url);
const EVENTS_FILE = new URL("../../public/content/live/events.json", import.meta.url);
const SCOREBOARD_FILE = new URL("../../public/content/live/scoreboard.json", import.meta.url);
const TOPICS_FILE = new URL("../../public/content/topics/index.json", import.meta.url);
const VIDEO_FILE = new URL("../../public/content/video/top.json", import.meta.url);
const NEWS_FILE = new URL("../../public/content/news/top.json", import.meta.url);
const SPORTS_FILE = new URL("../../public/content/sports/top.json", import.meta.url);
const TECH_FILE = new URL("../../public/content/tech/top.json", import.meta.url);

const STATIC_PAGE_LABELS = {
  "/": "Home",
  "/live": "Live",
  "/live/space": "Live Space",
  "/live/earth": "Live Earth",
  "/video": "Video",
  "/news": "News",
  "/sports": "Sports",
  "/tech": "Tech",
  "/games": "Games",
  "/gallery": "Gallery",
};

const GAME_MODE_DEFS = [
  {
    id: "headline-match",
    mode: "headline-match",
    title: "Headline Match",
    description: "Sort current headlines into the right section before the timer runs out.",
    relatedPath: "/news",
    relatedLabel: "Go to News",
  },
  {
    id: "timeline-sort",
    mode: "timeline-sort",
    title: "Timeline Sort",
    description: "Re-order live events from soonest to latest using the active event deck.",
    relatedPath: "/live",
    relatedLabel: "Go to Live",
  },
  {
    id: "world-quiz",
    mode: "world-quiz",
    title: "World Quiz",
    description: "Answer quick questions pulled from current live topics and sources.",
    relatedPath: "/gallery",
    relatedLabel: "Go to Gallery",
  },
  {
    id: "rapid-reaction",
    mode: "rapid-reaction",
    title: "Rapid Reaction",
    description: "Tap through a short focus drill tied to the live-event clock.",
    relatedPath: "/live/space",
    relatedLabel: "Go to Live Space",
  },
  {
    id: "sudoku",
    mode: "sudoku",
    title: "Sudoku",
    description: "A slower logic game for longer dwell time between live checks.",
    relatedPath: "/games",
    relatedLabel: "Stay in Games",
  },
  {
    id: "memory",
    mode: "memory",
    title: "Memory",
    description: "Quick pattern recall with XLB symbols and event cues.",
    relatedPath: "/games",
    relatedLabel: "Stay in Games",
  },
];

const STOPWORDS = new Set([
  "watch",
  "event",
  "events",
  "monitoring",
  "current",
  "summary",
  "source",
  "public",
  "interest",
  "space",
  "earth",
  "live",
]);

export async function loadTrafficEngineContext() {
  const snapshotFile = await resolveSnapshotFile();
  const [
    snapshot,
    liveEventsFeed,
    scoreboard,
    topicsFeed,
    videoFeed,
    newsFeed,
    sportsFeed,
    techFeed,
  ] = await Promise.all([
    readJson(snapshotFile),
    readJson(EVENTS_FILE),
    readJson(SCOREBOARD_FILE),
    readJson(TOPICS_FILE),
    readJson(VIDEO_FILE),
    readJson(NEWS_FILE),
    readJson(SPORTS_FILE),
    readJson(TECH_FILE),
  ]);

  return {
    snapshot,
    snapshotFile: fileURLToPath(snapshotFile),
    liveEventsFeed,
    scoreboard,
    topicsFeed,
    videoFeed,
    newsFeed,
    sportsFeed,
    techFeed,
    pageMap: new Map((snapshot.pages ?? []).map((item) => [item.path, item])),
    updatedAt: newestDate([
      snapshot.capturedAt,
      liveEventsFeed.updatedAt,
      scoreboard.updatedAt,
      topicsFeed.updatedAt,
      videoFeed.updatedAt,
      newsFeed.updatedAt,
      sportsFeed.updatedAt,
      techFeed.updatedAt,
    ]),
  };
}

async function resolveSnapshotFile() {
  const configured = process.env.XLB_ANALYTICS_SNAPSHOT?.trim();
  if (configured) {
    return new URL(configured, new URL("../../", import.meta.url));
  }

  const entries = await readdir(SNAPSHOT_DIR);
  const mergedSnapshots = entries
    .filter((entry) => /^merged-\d{4}-\d{2}-\d{2}\.json$/.test(entry))
    .sort();

  const latest = mergedSnapshots.at(-1);
  if (!latest) {
    throw new Error("No merged analytics snapshot was found in automation/snapshots");
  }

  return new URL(latest, SNAPSHOT_DIR);
}

async function readJson(fileUrl) {
  const contents = await readFile(fileUrl, "utf8");
  return JSON.parse(contents);
}

export function buildHomeModules(context) {
  const liveItems = promotedLiveItems(context).slice(0, 8);
  const liveNow = liveItems.filter((item) =>
    ["live", "watch", "monitoring"].includes(item.status),
  );
  const next24 = liveItems
    .filter((item) => item.status === "upcoming")
    .filter((item) => {
      const startsAt = Date.parse(item.startsAt);
      const delta = startsAt - Date.now();
      return Number.isFinite(delta) && delta > 0 && delta <= 24 * 60 * 60 * 1000;
    })
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  const nextAny = liveItems
    .filter((item) => item.status === "upcoming")
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt));
  const whyPeopleCheck = topWhyPages(context);

  return {
    updatedAt: context.updatedAt,
    thesis: "Live events plus embedded short-form video are the primary acquisition and retention loop.",
    items: [
      {
        id: "home-happening-now",
        kind: "happening_now",
        title: "Happening now",
        description: "The pages below are the fastest path into changing information on the site right now.",
        ctaLabel: "Open Live",
        ctaUrl: "/live",
        metrics: [
          {
            label: "Live pages",
            value: String(liveNow.length || liveItems.length),
          },
          {
            label: "Tracked sources",
            value: String(new Set(liveItems.map((item) => item.sourceName)).size),
          },
          {
            label: "Top pulse",
            value: compactNumber(topWhyPages(context)[0]?.pageviews ?? 0),
          },
        ],
        items: (liveNow.length ? liveNow : liveItems)
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: item.title,
            href: `/events/${item.slug}`,
            label: statusLabel(item.status),
            summary: item.featuredReason ?? item.summary,
            meta: `${item.sourceName} · ${formatShortDate(item.startsAt)}`,
          })),
        relatedLinks: [
          { label: "Full live inventory", href: "/live" },
          { label: "Video feed", href: "/video" },
          { label: "Space live pages", href: "/live/space" },
        ],
      },
      {
        id: "home-next-24-hours",
        kind: "next_24_hours",
        title: "Next 24 hours",
        description: "Upcoming launches and scheduled watch points that reward a return visit within a day.",
        ctaLabel: "Open launch rail",
        ctaUrl: "/live/space",
        metrics: [
          {
            label: "Next-day events",
            value: String((next24.length || nextAny.length)),
          },
          {
            label: "Launch candidates",
            value: String(nextAny.filter((item) => item.topic === "launches").length),
          },
          {
            label: "Return loop",
            value: compactNumber(context.pageMap.get("/")?.returnVisitors ?? 0),
          },
        ],
        items: (next24.length ? next24 : nextAny)
          .slice(0, 3)
          .map((item) => ({
            id: item.id,
            title: item.title,
            href: `/events/${item.slug}`,
            label: countdownLabel(item.startsAt),
            summary: item.summary,
            meta: `${item.sourceName} · ${formatShortDate(item.startsAt)}`,
          })),
        relatedLinks: [
          { label: "Live space", href: "/live/space" },
          { label: "Aurora watch", href: "/events/aurora-watch" },
          { label: "Earthquake watch", href: "/events/global-earthquake-watch" },
        ],
      },
      {
        id: "home-why-people-check",
        kind: "why_people_check",
        title: "Why people are checking this",
        description: "The early click and revisit signals already point to live pages and embedded video, not generic category walls.",
        ctaLabel: "Open video feed",
        ctaUrl: "/video",
        metrics: [
          {
            label: "Video views",
            value: compactNumber(context.pageMap.get("/video")?.pageviews ?? 0),
          },
          {
            label: "Home search impressions",
            value: compactNumber(context.pageMap.get("/")?.searchImpressions ?? 0),
          },
          {
            label: "Aurora pageviews",
            value: compactNumber(context.pageMap.get("/events/aurora-watch")?.pageviews ?? 0),
          },
        ],
        items: whyPeopleCheck.slice(0, 3).map((item) => ({
          id: `why-${item.path}`,
          title: item.label,
          href: item.path,
          label: `${compactNumber(item.pageviews)} views`,
          summary: explainPageInterest(item.path),
          meta: `${compactNumber(item.searchImpressions)} search impressions · engagement ${item.engagementScore}`,
        })),
        relatedLinks: [
          { label: "Top shorts", href: "/video" },
          { label: "Live event pages", href: "/live" },
          { label: "Current gallery", href: "/gallery" },
        ],
      },
    ],
  };
}

export function buildVideoShorts(context) {
  const pageSignal = context.pageMap.get("/video");
  const promotedEvents = promotedLiveItems(context);
  const candidates = (context.videoFeed.items ?? [])
    .filter((item) => item.embedUrl?.includes("youtube.com/embed/"))
    .map((item) => {
      const ageHours = Math.max((Date.now() - Date.parse(item.publishedAt)) / (1000 * 60 * 60), 0);
      const freshnessScore = Math.max(0, Math.round(100 - Math.min(ageHours, 96) * 1.2));
      const isShort = /\/shorts\/|#shorts/i.test(item.url) || /#shorts/i.test(item.title);
      const relatedPath = inferRelatedPath(item, promotedEvents, context.topicsFeed.items ?? []);

      return {
        ...item,
        sourceCategory: "youtube",
        isShort,
        relatedPath,
        relatedLabel: labelForPath(relatedPath, context),
        freshnessScore,
        preScore: freshnessScore + (isShort ? 14 : 0) + (pageSignal?.engagementScore ?? 0) * 0.18,
      };
    })
    .sort((left, right) => right.preScore - left.preScore);

  const selected = [];
  const sourceCounts = new Map();

  for (const item of candidates) {
    const sourceCount = sourceCounts.get(item.source) ?? 0;
    const diversityScore = Math.max(40, 100 - sourceCount * 18);
    const retentionScore = Math.round(
      item.freshnessScore * 0.42 +
        diversityScore * 0.18 +
        (pageSignal?.engagementScore ?? 0) * 0.25 +
        (item.isShort ? 15 : 6),
    );

    selected.push({
      id: item.id,
      title: item.title,
      source: item.source,
      url: item.url,
      embedUrl: item.embedUrl,
      publishedAt: item.publishedAt,
      summary: item.summary,
      relatedPath: item.relatedPath,
      relatedLabel: item.relatedLabel,
      sourceCategory: "youtube",
      isShort: item.isShort,
      freshnessScore: item.freshnessScore,
      diversityScore,
      retentionScore,
    });

    sourceCounts.set(item.source, sourceCount + 1);
    if (selected.length === 8) {
      break;
    }
  }

  return {
    updatedAt: context.updatedAt,
    thesis: "Embedded YouTube-first shorts keep users on XLB longer than link-out-only video cards.",
    items: selected.sort((left, right) => right.retentionScore - left.retentionScore),
  };
}

export function buildGamesCatalog(context) {
  const featuredTopic = context.topicsFeed.items?.[0];
  const gamesPage = context.pageMap.get("/games");
  const liveItems = promotedLiveItems(context);

  return {
    updatedAt: context.updatedAt,
    thesis: "Games are a retention layer tied to live content, not a standalone acquisition thesis.",
    items: GAME_MODE_DEFS.map((item, index) => {
      const event = liveItems[index % Math.max(liveItems.length, 1)];
      return {
        ...item,
        prompt:
          item.mode === "headline-match"
            ? `Use the latest News, Sports, and Tech items from ${labelForPath("/news", context)}, ${labelForPath("/sports", context)}, and ${labelForPath("/tech", context)}.`
            : item.mode === "timeline-sort"
              ? `Use active live events such as ${liveItems.slice(0, 3).map((entry) => entry.title).join(", ")}.`
              : item.mode === "world-quiz"
                ? `Focus on ${featuredTopic?.title ?? "current live topics"} and source-backed facts.`
                : item.mode === "rapid-reaction"
                  ? `Use a short timer tied to the ${event?.title ?? "current live event"} cadence.`
                  : `Keep this as a replayable support mode inside the Games section.`,
        metricLabel:
          item.mode === "headline-match" || item.mode === "world-quiz"
            ? "Fresh prompts"
            : item.mode === "timeline-sort"
              ? "Active events"
              : item.mode === "rapid-reaction"
                ? "Target time"
                : "Session depth",
        metricValue:
          item.mode === "headline-match"
            ? String(
                (context.newsFeed.items?.length ?? 0) +
                  (context.sportsFeed.items?.length ?? 0) +
                  (context.techFeed.items?.length ?? 0),
              )
            : item.mode === "timeline-sort"
              ? String(liveItems.filter((entry) => entry.status !== "ended").length)
              : item.mode === "rapid-reaction"
                ? "10 taps"
                : item.mode === "world-quiz"
                  ? String(context.topicsFeed.items?.length ?? 0)
                  : compactNumber(gamesPage?.engagementScore ?? 0),
        featured: index < 4,
      };
    }),
  };
}

export function buildGalleryCollections(context) {
  const liveItems = promotedLiveItems(context);
  const earthquake = liveItems.find((item) => item.slug === "global-earthquake-watch");
  const aurora = liveItems.find((item) => item.slug === "aurora-watch");
  const launches = liveItems.filter((item) => item.topic === "launches").slice(0, 3);
  const topics = [...(context.topicsFeed.items ?? [])]
    .sort((left, right) => right.bestScore - left.bestScore)
    .slice(0, 3);

  return {
    updatedAt: context.updatedAt,
    thesis: "Gallery is a live visual explainer surface tied to current events, not a detached poster lab.",
    items: [
      {
        id: "gallery-quake-snapshots",
        title: "Quake snapshots",
        description: "A compact visual explainer around earthquake activity and repeat-check behavior.",
        category: "quake",
        relatedPath: "/events/global-earthquake-watch",
        relatedLabel: "Open earthquake watch",
        entries: [
          {
            id: "quake-primary",
            title: earthquake?.title ?? "Global earthquake watch",
            summary: earthquake?.summary ?? "Source-backed earthquake monitoring.",
            metricLabel: "Updated",
            metricValue: formatShortDate(earthquake?.updatedAt ?? context.updatedAt),
            href: "/events/global-earthquake-watch",
            accent: "earth",
          },
          {
            id: "quake-earth",
            title: "Earth live rail",
            summary: "See how earthquake monitoring sits inside the broader earth-event surface.",
            metricLabel: "Live pages",
            metricValue: compactNumber(context.pageMap.get("/live/earth")?.pageviews ?? 0),
            href: "/live/earth",
            accent: "signal",
          },
          {
            id: "quake-topic",
            title: "Earthquakes topic",
            summary: "Topic route for crawlable follow-through and internal linking.",
            metricLabel: "Promoted",
            metricValue: String(
              (context.topicsFeed.items ?? []).find((item) => item.slug === "earthquakes")?.promotedEventCount ?? 0,
            ),
            href: "/topics/earthquakes",
            accent: "earth",
          },
        ],
      },
      {
        id: "gallery-aurora-state",
        title: "Aurora state cards",
        description: "Current Kp conditions, why they matter, and where the related traffic is landing.",
        category: "aurora",
        relatedPath: "/events/aurora-watch",
        relatedLabel: "Open aurora watch",
        entries: [
          {
            id: "aurora-primary",
            title: aurora?.title ?? "Aurora watch",
            summary: aurora?.summary ?? "Source-backed space-weather monitoring.",
            metricLabel: "Pageviews",
            metricValue: compactNumber(context.pageMap.get("/events/aurora-watch")?.pageviews ?? 0),
            href: "/events/aurora-watch",
            accent: "space",
          },
          {
            id: "aurora-space",
            title: "Space live rail",
            summary: "Browse the related launch and space-weather inventory.",
            metricLabel: "Space views",
            metricValue: compactNumber(context.pageMap.get("/live/space")?.pageviews ?? 0),
            href: "/live/space",
            accent: "signal",
          },
          {
            id: "aurora-topic",
            title: "Space weather topic",
            summary: "Crawlable topic route connected to the event page and homepage modules.",
            metricLabel: "Best score",
            metricValue: String(
              (context.topicsFeed.items ?? []).find((item) => item.slug === "space-weather")?.bestScore ?? 0,
            ),
            href: "/topics/space-weather",
            accent: "space",
          },
        ],
      },
      {
        id: "gallery-launch-windows",
        title: "Launch timeline visuals",
        description: "The upcoming launch rail pulled into a scan-friendly explainer layout.",
        category: "launch",
        relatedPath: "/live/space",
        relatedLabel: "Open live space",
        entries: launches.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          metricLabel: "Countdown",
          metricValue: countdownLabel(item.startsAt),
          href: `/events/${item.slug}`,
          accent: "space",
        })),
      },
      {
        id: "gallery-topic-rotation",
        title: "Topic rotation",
        description: "Internal-link depth and search entry points selected from the strongest live topics.",
        category: "topic",
        relatedPath: "/live",
        relatedLabel: "Open full live inventory",
        entries: topics.map((item, index) => ({
          id: item.slug,
          title: item.title,
          summary: item.summary,
          metricLabel: index === 0 ? "Best score" : "Event count",
          metricValue: index === 0 ? String(item.bestScore) : String(item.eventCount),
          href: `/topics/${item.slug}`,
          accent: index % 2 === 0 ? "signal" : "space",
        })),
      },
    ].filter((item) => item.entries.length > 0),
  };
}

export function buildSignalReport(context) {
  const topPages = [...(context.snapshot.pages ?? [])]
    .sort((left, right) => (right.pageviews ?? 0) - (left.pageviews ?? 0))
    .slice(0, 10)
    .map((item) => ({
      path: item.path,
      pageviews: item.pageviews ?? 0,
      searchImpressions: item.searchImpressions ?? 0,
      engagementScore: item.engagementScore ?? 0,
      returnVisitors: item.returnVisitors ?? 0,
      videoStarts: item.videoStarts ?? 0,
      gameStarts: item.gameStarts ?? 0,
      galleryOpens: item.galleryOpens ?? 0,
    }));

  return {
    updatedAt: context.updatedAt,
    snapshotFile: path.basename(context.snapshotFile),
    capturedAt: context.snapshot.capturedAt,
    sources: context.snapshot.sources,
    topPages,
  };
}

export function buildSurfaceRankingReport(context, homeModules, videoShorts, gamesCatalog, galleryCollections) {
  return {
    updatedAt: context.updatedAt,
    surfaces: {
      home: homeModules.items.map((item, index) => ({
        id: item.id,
        rank: index + 1,
        title: item.title,
        ctaUrl: item.ctaUrl,
        itemCount: item.items.length,
      })),
      video: videoShorts.items.map((item, index) => ({
        id: item.id,
        rank: index + 1,
        retentionScore: item.retentionScore,
        freshnessScore: item.freshnessScore,
        relatedPath: item.relatedPath,
      })),
      games: gamesCatalog.items.map((item, index) => ({
        id: item.id,
        rank: index + 1,
        featured: item.featured,
        relatedPath: item.relatedPath,
      })),
      gallery: galleryCollections.items.map((item, index) => ({
        id: item.id,
        rank: index + 1,
        category: item.category,
        entryCount: item.entries.length,
      })),
    },
  };
}

export function buildPruneReport(context) {
  const staleEvents = promotedLiveItems(context)
    .filter((item) => item.status === "ended")
    .filter((item) => Date.now() - Date.parse(item.startsAt) > 3 * 24 * 60 * 60 * 1000)
    .map((item) => ({
      slug: item.slug,
      title: item.title,
      reason: "ended event older than 72h",
    }));

  const deadSurfaces = [
    { path: "/gallery", page: context.pageMap.get("/gallery") },
    { path: "/games", page: context.pageMap.get("/games") },
  ]
    .filter(({ page }) => (page?.pageviews ?? 0) <= 2 && (page?.searchImpressions ?? 0) <= 3)
    .map(({ path, page }) => ({
      path,
      pageviews: page?.pageviews ?? 0,
      searchImpressions: page?.searchImpressions ?? 0,
      action: "demote-to-retention",
    }));

  return {
    updatedAt: context.updatedAt,
    staleEvents,
    deadSurfaces,
  };
}

export function buildExperimentLedger(context, homeModules, videoShorts, gamesCatalog, galleryCollections) {
  return {
    updatedAt: context.updatedAt,
    items: [
      ledgerItem("home", "entry pageviews", context.pageMap.get("/")?.pageviews ?? 0, homeModules.updatedAt),
      ledgerItem("live", "live pageviews", context.pageMap.get("/live")?.pageviews ?? 0, context.liveEventsFeed.updatedAt),
      ledgerItem("video", "video starts", sum(videoShorts.items.map((item) => item.retentionScore)), videoShorts.updatedAt),
      ledgerItem("games", "game starts", context.pageMap.get("/games")?.gameStarts ?? 0, gamesCatalog.updatedAt),
      ledgerItem("gallery", "gallery opens", context.pageMap.get("/gallery")?.galleryOpens ?? 0, galleryCollections.updatedAt),
    ],
  };
}

export function buildAutonomyState(context, homeModules, videoShorts, gamesCatalog, galleryCollections) {
  const coverage = Boolean(context.snapshot.sources?.ga4) && Boolean(context.snapshot.sources?.searchConsole);
  const activeSignals =
    (context.pageMap.get("/video")?.pageviews ?? 0) +
    (context.pageMap.get("/live")?.pageviews ?? 0) +
    (context.pageMap.get("/")?.searchImpressions ?? 0);

  return {
    assessedAt: context.updatedAt,
    status: coverage && activeSignals > 0 ? "active-learning" : "cold-start",
    isAutoDeployEligible: coverage,
    productThesis: "live-events-plus-shorts",
    manifestPublishMode: "main-direct",
    surfaceVersions: {
      home: homeModules.updatedAt,
      video: videoShorts.updatedAt,
      games: gamesCatalog.updatedAt,
      gallery: galleryCollections.updatedAt,
    },
    signals: {
      snapshot: path.basename(context.snapshotFile),
      activeSignals,
      homePageviews: context.pageMap.get("/")?.pageviews ?? 0,
      livePageviews: context.pageMap.get("/live")?.pageviews ?? 0,
      videoPageviews: context.pageMap.get("/video")?.pageviews ?? 0,
      returnVisitors: sum(
        [...context.pageMap.values()].map((item) => item.returnVisitors ?? 0),
      ),
    },
    focus: [
      "Promote live event pages and shorts on the home page.",
      "Keep games and gallery as retention surfaces until they show measurable lift.",
      "Auto-publish manifest-only changes directly to main.",
    ],
  };
}

function promotedLiveItems(context) {
  return [...(context.liveEventsFeed.items ?? [])]
    .filter((item) => item.safeToPromote)
    .sort((left, right) => scoreLiveItem(context, right) - scoreLiveItem(context, left));
}

function scoreLiveItem(context, item) {
  const score = context.scoreboard.items?.find((entry) => entry.slug === item.slug);
  return (
    (item.importance ?? 0) +
    (item.heroPriority ?? 0) +
    (score?.score ?? 0) +
    (score?.pageviews ?? 0) * 3 +
    (score?.searchImpressions ?? 0)
  );
}

function topWhyPages(context) {
  return [...(context.snapshot.pages ?? [])]
    .filter((item) => item.path in STATIC_PAGE_LABELS || item.path.startsWith("/events/") || item.path.startsWith("/topics/"))
    .sort((left, right) => {
      const leftScore = (left.pageviews ?? 0) * 3 + (left.searchImpressions ?? 0) + (left.engagementScore ?? 0);
      const rightScore = (right.pageviews ?? 0) * 3 + (right.searchImpressions ?? 0) + (right.engagementScore ?? 0);
      return rightScore - leftScore;
    })
    .map((item) => ({
      ...item,
      label: labelForPath(item.path, context),
    }));
}

function inferRelatedPath(item, events, topics) {
  const text = normalizeText(`${item.title} ${item.summary} ${item.source}`);
  const matchingEvent = events.find((event) =>
    relatedTokens(event).some((token) => token && text.includes(token)),
  );

  if (matchingEvent) {
    return `/events/${matchingEvent.slug}`;
  }

  const matchingTopic = topics.find((topic) =>
    normalizeText(`${topic.title} ${topic.slug}`).split(" ").some((token) => token && text.includes(token)),
  );

  if (matchingTopic) {
    return `/topics/${matchingTopic.slug}`;
  }

  if (/launch|rocket|nasa|spacex|space/i.test(text)) {
    return "/live/space";
  }
  if (/earthquake|storm|weather|aurora|solar|quake/i.test(text)) {
    return "/live/earth";
  }
  return "/news";
}

function relatedTokens(event) {
  return [
    event.slug,
    event.topic,
    ...normalizeText(event.title).split(" "),
  ].filter((token) => token.length >= 5 && !STOPWORDS.has(token));
}

function labelForPath(routePath, context) {
  if (STATIC_PAGE_LABELS[routePath]) {
    return STATIC_PAGE_LABELS[routePath];
  }

  if (routePath.startsWith("/events/")) {
    return (
      context.liveEventsFeed.items?.find((item) => `/events/${item.slug}` === routePath)?.title ??
      "Event page"
    );
  }

  if (routePath.startsWith("/topics/")) {
    return (
      context.topicsFeed.items?.find((item) => `/topics/${item.slug}` === routePath)?.title ??
      "Topic page"
    );
  }

  return routePath;
}

function explainPageInterest(routePath) {
  if (routePath === "/video") {
    return "Users are already choosing video more often than games or gallery, so the feed needs in-page playback.";
  }
  if (routePath === "/live") {
    return "Live pages work because the information can change between visits and there is a clear reason to come back.";
  }
  if (routePath === "/") {
    return "The home page should route visitors into live events and shorts instead of acting like a static section index.";
  }
  if (routePath.includes("aurora")) {
    return "Aurora monitoring is already showing early repeat-check behavior and should stay featured.";
  }
  if (routePath.includes("earthquake")) {
    return "Earthquake monitoring gives the site a continuously updating public-information surface.";
  }
  return "This page is already attracting more attention than the lower-signal utility surfaces.";
}

function newestDate(values) {
  const timestamps = values
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));

  return new Date(Math.max(...timestamps)).toISOString();
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function statusLabel(status) {
  if (status === "watch") {
    return "Watch";
  }
  if (status === "monitoring") {
    return "Monitoring";
  }
  if (status === "live") {
    return "Live now";
  }
  if (status === "upcoming") {
    return "Upcoming";
  }
  return "Ended";
}

function countdownLabel(value) {
  const diff = Date.parse(value) - Date.now();
  if (!Number.isFinite(diff)) {
    return "TBD";
  }
  if (diff <= 0) {
    return "Starting";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatShortDate(value) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return "time pending";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function compactNumber(value) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value ?? 0);
}

function ledgerItem(surface, targetMetric, observedDelta, version) {
  return {
    surface,
    moduleVersion: version,
    startDate: version.slice(0, 10),
    targetMetric,
    observedDelta,
    decision: observedDelta > 0 ? "keep" : "replace",
  };
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
