import { readFile } from "node:fs/promises";
import path from "node:path";

const USGS_EARTHQUAKE_FEED_URL =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

export async function fetchUsgsEarthquakeSeeds() {
  const { json, fallbackUsed } = await loadEarthquakeFeedJson();
  const { items, stats } = parseEarthquakeFeed(json);

  if (!items.length) {
    throw new Error("USGS earthquake feed returned no parseable live event seeds");
  }

  return {
    items,
    stats,
    fallbackUsed,
  };
}

async function loadEarthquakeFeedJson() {
  const fixtureDir = process.env.XLB_LIVE_EVENTS_FIXTURE_DIR;
  const bundledFixture = new URL("./fixtures/usgs-all-day.geojson", import.meta.url);

  if (fixtureDir) {
    const fixturePath = path.join(fixtureDir, "usgs-all-day.geojson");

    try {
      const contents = await readFile(fixturePath, "utf8");
      return { json: JSON.parse(contents), fallbackUsed: true };
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  try {
    const response = await fetch(USGS_EARTHQUAKE_FEED_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "xlb-live-events-automation/1.0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`USGS earthquake feed request failed: ${response.status} ${response.statusText}`);
    }

    return { json: await response.json(), fallbackUsed: false };
  } catch {
    const contents = await readFile(bundledFixture, "utf8");
    return { json: JSON.parse(contents), fallbackUsed: true };
  }
}

export function parseEarthquakeFeed(feed) {
  const features = Array.isArray(feed?.features) ? feed.features : [];
  const validFeatures = features.filter((feature) => {
    const magnitude = Number(feature?.properties?.mag);
    const place = feature?.properties?.place;
    const eventUrl = feature?.properties?.url;
    return Number.isFinite(magnitude) && typeof place === "string" && typeof eventUrl === "string";
  });

  if (!validFeatures.length) {
    return { items: [], stats: buildEmptyStats(features.length) };
  }

  const strongestFeature = validFeatures.reduce((best, feature) =>
    Number(feature.properties.mag) > Number(best.properties.mag) ? feature : best,
  );
  const recentTimestamp = Math.max(
    ...validFeatures
      .map((feature) => Number(feature.properties?.time))
      .filter((value) => Number.isFinite(value)),
  );
  const largeCount = validFeatures.filter((feature) => Number(feature.properties.mag) >= 4.5).length;
  const stats = {
    featureCount: validFeatures.length,
    largeCount,
    strongestMagnitude: roundMagnitude(Number(strongestFeature.properties.mag)),
    strongestPlace: strongestFeature.properties.place,
    feedUpdatedAt: toIsoOrNow(Number(feed?.metadata?.generated)),
    mostRecentEventAt: toIsoOrNow(recentTimestamp),
  };

  return {
    items: [buildEarthquakeWatchItem(stats)],
    stats,
  };
}

function buildEmptyStats(featureCount) {
  return {
    featureCount,
    largeCount: 0,
    strongestMagnitude: 0,
    strongestPlace: "global activity",
    feedUpdatedAt: new Date().toISOString(),
    mostRecentEventAt: new Date().toISOString(),
  };
}

export function buildEarthquakeWatchItem(stats) {
  const largestLabel =
    stats.strongestMagnitude > 0
      ? `Strongest reported event: M${stats.strongestMagnitude} near ${stats.strongestPlace}.`
      : "No large earthquake summary is available yet.";

  return {
    id: "earth-global-earthquake-watch",
    slug: "global-earthquake-watch",
    title: "Global earthquake watch",
    status: "monitoring",
    category: "earth",
    topic: "earthquakes",
    startsAt: stats.mostRecentEventAt,
    summary: `USGS reported ${stats.featureCount} earthquake events in the last 24 hours. ${largestLabel}`,
    whyItMatters:
      "Earthquake monitoring is a naturally recurring live-information topic with strong revisit potential and authoritative public data.",
    sourceName: "USGS Earthquake Hazards Program",
    sourceUrl: "https://earthquake.usgs.gov/earthquakes/map/",
    watchUrl: "https://earthquake.usgs.gov/earthquakes/map/",
    coverageMode: "link",
    safeToPromote: true,
    heroPriority: stats.largeCount > 0 ? 94 : 88,
    rightsProfile: "public-information",
    cadence: "continuous",
    audienceIntent: "monitor-live",
    updatedAt: stats.feedUpdatedAt,
  };
}

export function roundMagnitude(value) {
  return Math.round(value * 10) / 10;
}

export function toIsoOrNow(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return new Date().toISOString();
  }

  return new Date(timestamp).toISOString();
}
