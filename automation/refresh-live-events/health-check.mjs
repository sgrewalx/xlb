import { fileURLToPath } from "node:url";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const EVENTS_FILE = new URL("../../public/content/live/events.json", import.meta.url);
const SOURCE_INTAKE_FILE = new URL("../../automation/reports/live-source-intake.json", import.meta.url);
const HISTORY_FILE = new URL("../../automation/reports/live-source-history.json", import.meta.url);
const OUTPUT_FILE = new URL("../../automation/reports/live-source-health.json", import.meta.url);

export function getStabilityThresholds() {
  return {
    historyLimit: Number(process.env.XLB_SOURCE_HISTORY_LIMIT ?? 14),
    minimumStableRuns: Number(process.env.XLB_MIN_SOURCE_STABILITY_STREAK ?? 3),
  };
}

async function main() {
  const events = await readJsonIfExists(EVENTS_FILE);
  const sourceIntake = await readJsonIfExists(SOURCE_INTAKE_FILE);
  const previousHistory = await readJsonIfExists(HISTORY_FILE);
  const thresholds = getStabilityThresholds();

  if (!events?.items?.length) {
    throw new Error("Live events manifest is missing or empty");
  }

  const assessedAt = new Date().toISOString();
  const launchItems = events.items.filter((item) => item.topic === "launches");
  const earthquakeItems = events.items.filter((item) => item.topic === "earthquakes");
  const spaceWeatherItems = events.items.filter((item) => item.topic === "space-weather");
  const degradedReasons = [
    ...getLaunchDegradedReasons(launchItems),
    ...getEarthquakeDegradedReasons(earthquakeItems),
    ...getSpaceWeatherDegradedReasons(spaceWeatherItems),
  ];
  const intakeSources = sourceIntake?.sources ?? [];

  const currentSources = buildCurrentSources({
    intakeSources,
    launchItems,
    earthquakeItems,
    spaceWeatherItems,
    degradedReasons,
  });
  const history = rollForwardSourceHistory({
    previousHistory,
    checkedAt: assessedAt,
    sources: currentSources,
    thresholds,
  });
  const report = {
    checkedAt: assessedAt,
    status: degradedReasons.length ? "degraded" : "healthy",
    stability: {
      status: history.allSourcesStable ? "stable" : "earning-trust",
      allSourcesStable: history.allSourcesStable,
      thresholds: history.thresholds,
    },
    sources: history.sources,
    degradedReasons,
  };

  await writeJsonIfChanged(HISTORY_FILE, history);
  await writeJsonIfChanged(OUTPUT_FILE, report);
  console.log(
    `Updated automation/reports/live-source-history.json (${history.allSourcesStable ? "stable" : "earning-trust"})`,
  );
  console.log(`Updated automation/reports/live-source-health.json (${report.status})`);

  if (process.env.XLB_FAIL_ON_DEGRADED_SOURCES === "1" && degradedReasons.length) {
    throw new Error(`Source health degraded: ${degradedReasons.join("; ")}`);
  }
}

export function getLaunchDegradedReasons(launchItems) {
  const degradedReasons = [];
  const relevantLaunchItems = launchItems.filter((item) => item.status === "upcoming");

  if (relevantLaunchItems.length < 2) {
    degradedReasons.push("launch topic has fewer than 2 source-backed events");
  }

  const placeholderCount = launchItems.filter((item) => item.rightsProfile === "internal-placeholder").length;
  if (placeholderCount > 0) {
    degradedReasons.push("launch topic still contains placeholder events");
  }

  const staleUpcomingItems = relevantLaunchItems.filter((item) => {
    const now = Date.now();
    const startsAt = Date.parse(item.startsAt);
    return Number.isFinite(startsAt) && startsAt < now - 2 * 24 * 60 * 60 * 1000;
  });

  if (staleUpcomingItems.length > 0) {
    degradedReasons.push("launch topic contains stale upcoming events");
  }

  return degradedReasons;
}

export function getEarthquakeDegradedReasons(earthquakeItems) {
  const degradedReasons = [];

  if (earthquakeItems.length < 1) {
    degradedReasons.push("earthquake topic has no source-backed monitoring event");
  }

  const nonMonitoringCount = earthquakeItems.filter((item) => item.status !== "monitoring").length;
  if (nonMonitoringCount > 0) {
    degradedReasons.push("earthquake topic contains non-monitoring event states");
  }

  return degradedReasons;
}

export function getSpaceWeatherDegradedReasons(spaceWeatherItems) {
  const degradedReasons = [];

  if (spaceWeatherItems.length < 1) {
    degradedReasons.push("space weather topic has no source-backed monitoring event");
  }

  const nonMonitoringCount = spaceWeatherItems.filter((item) => item.status !== "monitoring").length;
  if (nonMonitoringCount > 0) {
    degradedReasons.push("space weather topic contains non-monitoring event states");
  }

  return degradedReasons;
}

function countPlaceholders(items) {
  return items.filter((item) => item.rightsProfile === "internal-placeholder").length;
}

function countStaleUpcoming(items) {
  return items.filter((item) => {
    if (item.status !== "upcoming") {
      return false;
    }

    const now = Date.now();
    const startsAt = Date.parse(item.startsAt);
    return Number.isFinite(startsAt) && startsAt < now - 2 * 24 * 60 * 60 * 1000;
  }).length;
}

export function buildCurrentSources({
  intakeSources,
  launchItems,
  earthquakeItems,
  spaceWeatherItems,
  degradedReasons,
}) {
  const intakeById = new Map(intakeSources.map((source) => [source.id, source]));
  const launchReasons = degradedReasons.filter((reason) => reason.startsWith("launch topic"));
  const earthquakeReasons = degradedReasons.filter((reason) => reason.startsWith("earthquake topic"));
  const spaceWeatherReasons = degradedReasons.filter((reason) => reason.startsWith("space weather topic"));

  const nasaIntake = intakeById.get("nasa-launch-schedule");
  const usgsIntake = intakeById.get("usgs-earthquakes");
  const noaaIntake = intakeById.get("noaa-space-weather");

  return [
    {
      id: "nasa-launch-schedule",
      status:
        launchReasons.length > 0 || nasaIntake?.status === "degraded" ? "degraded" : "healthy",
      fallbackUsed: Boolean(nasaIntake?.fallbackUsed),
      launchItemCount: launchItems.length,
      placeholderCount: countPlaceholders(launchItems),
      staleUpcomingCount: countStaleUpcoming(launchItems),
      fetchedSeedCount: nasaIntake?.fetchedSeedCount ?? launchItems.length,
      freshSeedCount: nasaIntake?.freshSeedCount ?? launchItems.length,
      staleSeedCount: nasaIntake?.staleSeedCount ?? 0,
      error: nasaIntake?.error ?? null,
    },
    {
      id: "usgs-earthquakes",
      status:
        earthquakeReasons.length > 0 || usgsIntake?.status === "degraded" ? "degraded" : "healthy",
      fallbackUsed: Boolean(usgsIntake?.fallbackUsed),
      earthquakeItemCount: earthquakeItems.length,
      placeholderCount: countPlaceholders(earthquakeItems),
      monitoringItemCount: earthquakeItems.filter((item) => item.status === "monitoring").length,
      fetchedSeedCount: usgsIntake?.fetchedSeedCount ?? earthquakeItems.length,
      freshSeedCount: usgsIntake?.freshSeedCount ?? earthquakeItems.length,
      staleSeedCount: usgsIntake?.staleSeedCount ?? 0,
      strongestMagnitude: usgsIntake?.strongestMagnitude ?? 0,
      largeCount: usgsIntake?.largeCount ?? 0,
      error: usgsIntake?.error ?? null,
    },
    {
      id: "noaa-space-weather",
      status:
        spaceWeatherReasons.length > 0 || noaaIntake?.status === "degraded" ? "degraded" : "healthy",
      fallbackUsed: Boolean(noaaIntake?.fallbackUsed),
      spaceWeatherItemCount: spaceWeatherItems.length,
      placeholderCount: countPlaceholders(spaceWeatherItems),
      monitoringItemCount: spaceWeatherItems.filter((item) => item.status === "monitoring").length,
      fetchedSeedCount: noaaIntake?.fetchedSeedCount ?? spaceWeatherItems.length,
      freshSeedCount: noaaIntake?.freshSeedCount ?? spaceWeatherItems.length,
      staleSeedCount: noaaIntake?.staleSeedCount ?? 0,
      latestKp: noaaIntake?.latestKp ?? 0,
      recentPeakKp: noaaIntake?.recentPeakKp ?? 0,
      alertLevel: noaaIntake?.alertLevel ?? "quiet",
      error: noaaIntake?.error ?? null,
    },
  ];
}

export function rollForwardSourceHistory({ previousHistory, checkedAt, sources, thresholds }) {
  const previousSources = new Map((previousHistory?.sources ?? []).map((source) => [source.id, source]));
  const nextSources = sources.map((source) => {
    const previousRuns = Array.isArray(previousSources.get(source.id)?.recentRuns)
      ? previousSources.get(source.id).recentRuns
      : [];
    const currentRun = {
      checkedAt,
      status: source.status,
      fallbackUsed: source.fallbackUsed,
      freshSeedCount: source.freshSeedCount,
    };
    const recentRuns = [currentRun, ...previousRuns].slice(0, thresholds.historyLimit);
    const healthyStreak = countConsecutive(recentRuns, (run) => run.status === "healthy");
    const nonFallbackStreak = countConsecutive(recentRuns, (run) => run.fallbackUsed === false);
    const stable =
      healthyStreak >= thresholds.minimumStableRuns &&
      nonFallbackStreak >= thresholds.minimumStableRuns;

    return {
      ...source,
      healthyStreak,
      nonFallbackStreak,
      stable,
      recentRuns,
    };
  });

  return {
    checkedAt,
    allSourcesStable: nextSources.every((source) => source.stable),
    thresholds: {
      minimumStableRuns: thresholds.minimumStableRuns,
    },
    sources: nextSources,
  };
}

export function countConsecutive(runs, predicate) {
  let count = 0;

  for (const run of runs) {
    if (!predicate(run)) {
      break;
    }

    count += 1;
  }

  return count;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
