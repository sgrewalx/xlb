import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";
import { formatTopicTitle, summarizeTopic } from "../shared/live-topic-copy.mjs";
import { fetchNasaLaunchSeeds } from "./fetch-nasa-launches.mjs";
import { fetchNoaaSpaceWeatherSeeds } from "./fetch-noaa-space-weather.mjs";
import { fetchUsgsEarthquakeSeeds } from "./fetch-usgs-earthquakes.mjs";

const SOURCE_FILE = new URL("./source.json", import.meta.url);
const EVENTS_FILE = new URL("../../public/content/live/events.json", import.meta.url);
const TOPICS_FILE = new URL("../../public/content/topics/index.json", import.meta.url);
const SCOREBOARD_FILE = new URL("../../public/content/live/scoreboard.json", import.meta.url);
const VIDEO_FILE = new URL("../../public/content/video/top.json", import.meta.url);
const SOURCE_INTAKE_FILE = new URL("../../automation/reports/live-source-intake.json", import.meta.url);

async function main() {
  const source = await readJsonIfExists(SOURCE_FILE);

  if (!source?.items?.length) {
    throw new Error("Live-event source inventory is missing or empty");
  }

  const { items: sourceItems, intake } = await hydrateSourceItems(source.items);

  const scoreboard = await readJsonIfExists(SCOREBOARD_FILE);
  const videoFeed = await readJsonIfExists(VIDEO_FILE);
  const scoreMap = new Map((scoreboard?.items ?? []).map((item) => [item.slug, item]));
  const videoItems = videoFeed?.items ?? [];
  const updatedAt = new Date().toISOString();

  const events = sourceItems
    .map((item) => {
      const score = scoreMap.get(item.slug);

      return {
        ...item,
        status: normalizeEventStatus(item),
        safeToPromote:
          item.safeToPromote && score ? score.recommendation !== "prune" : item.safeToPromote,
        heroPriority: tunePriority(item.heroPriority ?? 0, score?.recommendation),
        importance: computeImportance(item, score),
        featuredReason: buildFeaturedReason(item, score),
        relatedVideoIds: inferRelatedVideoIds(item, videoItems),
        relatedGameIds: inferRelatedGameIds(item),
        relatedGalleryIds: inferRelatedGalleryIds(item),
        updatedAt,
      };
    })
    .sort((left, right) => (right.heroPriority ?? 0) - (left.heroPriority ?? 0));

  const topics = buildTopics(events, scoreMap, updatedAt);

  const eventsChanged = await writeJsonIfChanged(EVENTS_FILE, {
    updatedAt,
    section: "Live Events",
    items: events,
  });

  const topicsChanged = await writeJsonIfChanged(TOPICS_FILE, {
    updatedAt,
    items: topics,
  });
  const intakeChanged = await writeJsonIfChanged(SOURCE_INTAKE_FILE, {
    generatedAt: updatedAt,
    ...intake,
  });

  console.log(
    eventsChanged
      ? "Updated public/content/live/events.json"
      : "public/content/live/events.json already matched generated output",
  );
  console.log(
    topicsChanged
      ? "Updated public/content/topics/index.json"
      : "public/content/topics/index.json already matched generated output",
  );
  console.log(
    intakeChanged
      ? "Updated automation/reports/live-source-intake.json"
      : "automation/reports/live-source-intake.json already matched generated output",
  );
}

async function hydrateSourceItems(items) {
  const staticItems = items.filter(
    (item) => !["launches", "earthquakes", "space-weather"].includes(item.topic),
  );
  const hasPlaceholderLaunch = items.some((item) => item.rightsProfile === "internal-placeholder");
  const earthquakeSeeds = items.filter((item) => item.topic === "earthquakes");
  const auroraSeeds = items.filter((item) => item.topic === "space-weather");
  const intake = {
    staticItemCount: staticItems.length,
    sources: [],
  };
  const hydratedItems = [...staticItems];

  try {
    const { items: nasaLaunchSeeds, fallbackUsed } = await fetchNasaLaunchSeeds();
    const freshLaunchSeeds = filterFreshLaunchSeeds(nasaLaunchSeeds);
    intake.sources.push({
      id: "nasa-launch-schedule",
      status: freshLaunchSeeds.length >= 2 ? "healthy" : "degraded",
      fallbackUsed,
      fetchedSeedCount: nasaLaunchSeeds.length,
      freshSeedCount: freshLaunchSeeds.length,
      staleSeedCount: Math.max(nasaLaunchSeeds.length - freshLaunchSeeds.length, 0),
    });
    hydratedItems.push(...freshLaunchSeeds);
  } catch (error) {
    intake.sources.push({
      id: "nasa-launch-schedule",
      status: "degraded",
      fallbackUsed: false,
      fetchedSeedCount: 0,
      freshSeedCount: 0,
      staleSeedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    });

    if (!hasPlaceholderLaunch) {
      throw error;
    }

    console.warn(
      `launch source fallback engaged: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    hydratedItems.push(...items.filter((item) => item.topic === "launches"));
  }

  try {
    const { items: usgsEarthquakeSeeds, stats, fallbackUsed } = await fetchUsgsEarthquakeSeeds();
    intake.sources.push({
      id: "usgs-earthquakes",
      status: usgsEarthquakeSeeds.length >= 1 ? "healthy" : "degraded",
      fallbackUsed,
      fetchedSeedCount: stats.featureCount,
      freshSeedCount: usgsEarthquakeSeeds.length,
      staleSeedCount: 0,
      strongestMagnitude: stats.strongestMagnitude,
      largeCount: stats.largeCount,
    });
    hydratedItems.push(...usgsEarthquakeSeeds);
  } catch (error) {
    intake.sources.push({
      id: "usgs-earthquakes",
      status: "degraded",
      fallbackUsed: false,
      fetchedSeedCount: 0,
      freshSeedCount: 0,
      staleSeedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    });
    hydratedItems.push(...earthquakeSeeds);
  }

  try {
    const { items: noaaSpaceWeatherSeeds, stats, fallbackUsed } = await fetchNoaaSpaceWeatherSeeds();
    intake.sources.push({
      id: "noaa-space-weather",
      status: noaaSpaceWeatherSeeds.length >= 1 ? "healthy" : "degraded",
      fallbackUsed,
      fetchedSeedCount: stats.sampleCount,
      freshSeedCount: noaaSpaceWeatherSeeds.length,
      staleSeedCount: 0,
      latestKp: stats.latestKp,
      recentPeakKp: stats.recentPeakKp,
      alertLevel: stats.alertLevel,
    });
    hydratedItems.push(...noaaSpaceWeatherSeeds);
  } catch (error) {
    intake.sources.push({
      id: "noaa-space-weather",
      status: "degraded",
      fallbackUsed: false,
      fetchedSeedCount: 0,
      freshSeedCount: 0,
      staleSeedCount: 0,
      error: error instanceof Error ? error.message : String(error),
    });
    hydratedItems.push(...auroraSeeds);
  }

  return { items: hydratedItems, intake };
}

function filterFreshLaunchSeeds(items) {
  const cutoff = Date.now() - 2 * 24 * 60 * 60 * 1000;

  return items.filter((item) => {
    const startsAt = Date.parse(item.startsAt);
    return !Number.isFinite(startsAt) || startsAt >= cutoff;
  });
}

function buildTopics(events, scoreMap, updatedAt) {
  const groups = new Map();

  events.forEach((event) => {
    const bucket = groups.get(event.topic) ?? [];
    bucket.push(event);
    groups.set(event.topic, bucket);
  });

  return [...groups.entries()].map(([topic, items]) => {
    const scores = items
      .map((item) => scoreMap.get(item.slug)?.score ?? 0)
      .filter((value) => typeof value === "number");
    const bestScore = Math.max(...scores, 0);
    const promotedCount = items.filter((item) => item.safeToPromote).length;
    const category = items[0]?.category ?? "space";

    return {
      slug: topic,
      title: formatTopicTitle(topic),
      category,
      summary: summarizeTopic(items, scoreMap),
      eventCount: items.length,
      promotedEventCount: promotedCount,
      bestScore,
      recommendation: bestScore >= 150 ? "expand" : promotedCount > 0 ? "hold" : "review",
      updatedAt,
    };
  });
}

function tunePriority(priority, recommendation) {
  if (recommendation === "expand") {
    return Math.min(priority + 8, 100);
  }

  if (recommendation === "prune") {
    return Math.max(priority - 18, 0);
  }

  return priority;
}

function normalizeEventStatus(item) {
  if (item.status !== "upcoming") {
    return item.status;
  }

  const startsAt = Date.parse(item.startsAt);

  if (!Number.isFinite(startsAt)) {
    return item.status;
  }

  return startsAt < Date.now() ? "ended" : item.status;
}

function computeImportance(item, score) {
  const scoreSignal = score?.score ?? 0;
  const trafficSignal = (score?.pageviews ?? 0) * 3 + (score?.searchImpressions ?? 0);
  return Math.max(0, Math.min(100, Math.round((item.heroPriority ?? 0) * 0.55 + scoreSignal * 0.3 + trafficSignal * 0.15)));
}

function buildFeaturedReason(item, score) {
  if (item.status === "monitoring") {
    return `${item.sourceName} is producing continuously updated public data, which makes this page a repeat-check surface.`;
  }

  if (item.status === "watch" || item.status === "live") {
    return `${item.sourceName} is already a direct watch destination, so the event page should keep routing visitors in and back out cleanly.`;
  }

  if (score?.recommendation === "expand") {
    return "This event is one of the stronger expand candidates in the current live inventory.";
  }

  return "This event stays promoted because it supports a clear internal path across live, topic, and related surfaces.";
}

function inferRelatedVideoIds(item, videoItems) {
  const tokens = normalizeText(`${item.title} ${item.topic}`)
    .split(" ")
    .filter((token) => token.length >= 5);

  return videoItems
    .filter((video) =>
      normalizeText(`${video.title} ${video.source}`)
        .split(" ")
        .some((token) => token.length >= 5 && tokens.includes(token)),
    )
    .slice(0, 3)
    .map((video) => video.id);
}

function inferRelatedGameIds(item) {
  const ids = ["headline-match", "timeline-sort"];
  if (item.category === "earth") {
    ids.push("world-quiz");
  } else {
    ids.push("rapid-reaction");
  }
  return ids;
}

function inferRelatedGalleryIds(item) {
  if (item.slug === "global-earthquake-watch") {
    return ["gallery-quake-snapshots", "gallery-topic-rotation"];
  }
  if (item.slug === "aurora-watch") {
    return ["gallery-aurora-state", "gallery-topic-rotation"];
  }
  if (item.topic === "launches") {
    return ["gallery-launch-windows", "gallery-topic-rotation"];
  }
  return ["gallery-topic-rotation"];
}

function normalizeText(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
