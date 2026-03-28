import { readFile } from "node:fs/promises";
import path from "node:path";

const NOAA_KP_URL = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

export async function fetchNoaaSpaceWeatherSeeds() {
  const { json, fallbackUsed } = await loadKpJson();
  const { items, stats } = parseKpFeed(json);

  if (!items.length) {
    throw new Error("NOAA Kp feed returned no parseable space-weather seeds");
  }

  return {
    items,
    stats,
    fallbackUsed,
  };
}

async function loadKpJson() {
  const fixtureDir = process.env.XLB_LIVE_EVENTS_FIXTURE_DIR;
  const bundledFixture = new URL("./fixtures/noaa-kp-index.json", import.meta.url);

  if (fixtureDir) {
    const fixturePath = path.join(fixtureDir, "noaa-kp-index.json");

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
    const response = await fetch(NOAA_KP_URL, {
      headers: {
        accept: "application/json",
        "user-agent": "xlb-live-events-automation/1.0",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`NOAA Kp feed request failed: ${response.status} ${response.statusText}`);
    }

    return { json: await response.json(), fallbackUsed: false };
  } catch {
    const contents = await readFile(bundledFixture, "utf8");
    return { json: JSON.parse(contents), fallbackUsed: true };
  }
}

export function parseKpFeed(feed) {
  const rows = Array.isArray(feed) ? feed : [];
  const validRows = rows.filter((row) => Number.isFinite(Number(row?.kp_index)));

  if (!validRows.length) {
    return { items: [], stats: buildEmptyStats(rows.length) };
  }

  const latestRow = validRows.at(-1);
  const latestKp = Number(latestRow.kp_index);
  const recentWindow = validRows.slice(-180);
  const recentPeak = recentWindow.reduce(
    (peak, row) => Math.max(peak, Number(row.kp_index)),
    latestKp,
  );
  const observationTime = toIsoOrNow(latestRow.time_tag);
  const stats = {
    sampleCount: validRows.length,
    latestKp: roundKp(latestKp),
    recentPeakKp: roundKp(recentPeak),
    alertLevel: inferAlertLevel(recentPeak),
    updatedAt: observationTime,
  };

  return {
    items: [buildAuroraWatchItem(stats)],
    stats,
  };
}

function buildEmptyStats(sampleCount) {
  return {
    sampleCount,
    latestKp: 0,
    recentPeakKp: 0,
    alertLevel: "quiet",
    updatedAt: new Date().toISOString(),
  };
}

export function buildAuroraWatchItem(stats) {
  const latestLabel =
    stats.latestKp >= 5
      ? `Geomagnetic storm conditions reached Kp ${stats.latestKp}.`
      : `Current geomagnetic conditions are near Kp ${stats.latestKp}.`;
  const peakLabel =
    stats.recentPeakKp > stats.latestKp
      ? `Recent peak reached Kp ${stats.recentPeakKp}.`
      : `Recent peak is Kp ${stats.recentPeakKp}.`;

  return {
    id: "space-aurora-watch",
    slug: "aurora-watch",
    title: "Aurora watch",
    status: "monitoring",
    category: "space",
    topic: "space-weather",
    startsAt: stats.updatedAt,
    summary: `${latestLabel} ${peakLabel} NOAA SWPC monitoring remains active.`,
    whyItMatters:
      "Aurora and geomagnetic conditions drive recurring public-interest checking behavior and diversify the space category beyond launches.",
    sourceName: "NOAA Space Weather Prediction Center",
    sourceUrl: "https://www.swpc.noaa.gov/products/planetary-k-index",
    watchUrl: "https://www.swpc.noaa.gov/products/planetary-k-index",
    coverageMode: "link",
    safeToPromote: true,
    heroPriority: stats.recentPeakKp >= 5 ? 95 : stats.recentPeakKp >= 4 ? 90 : 84,
    rightsProfile: "public-information",
    cadence: "continuous",
    audienceIntent: "monitor-live",
    updatedAt: stats.updatedAt,
  };
}

export function inferAlertLevel(kp) {
  if (kp >= 9) {
    return "extreme";
  }
  if (kp >= 8) {
    return "severe";
  }
  if (kp >= 7) {
    return "strong";
  }
  if (kp >= 5) {
    return "storm";
  }
  if (kp >= 4) {
    return "active";
  }
  return "quiet";
}

export function roundKp(value) {
  return Math.round(value * 10) / 10;
}

export function toIsoOrNow(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return new Date().toISOString();
  }

  const normalized = value.endsWith("Z") ? value : `${value}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf()) ? new Date().toISOString() : date.toISOString();
}
