import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCurrentSources,
  countConsecutive,
  getEarthquakeDegradedReasons,
  getLaunchDegradedReasons,
  getSpaceWeatherDegradedReasons,
  rollForwardSourceHistory,
} from "./health-check.mjs";

test("getLaunchDegradedReasons flags too-few launch items", () => {
  const reasons = getLaunchDegradedReasons([
    {
      startsAt: "2026-04-01T00:00:00.000Z",
      rightsProfile: "public-information",
    },
  ]);

  assert.deepEqual(reasons, ["launch topic has fewer than 2 source-backed events"]);
});

test("buildCurrentSources carries intake metadata into the current source snapshot", () => {
  const sources = buildCurrentSources({
    intakeSources: [
      {
        id: "nasa-launch-schedule",
        status: "healthy",
        fallbackUsed: true,
        fetchedSeedCount: 3,
        freshSeedCount: 2,
        staleSeedCount: 1,
      },
      {
        id: "usgs-earthquakes",
        status: "healthy",
        fallbackUsed: false,
        fetchedSeedCount: 42,
        freshSeedCount: 1,
        staleSeedCount: 0,
        strongestMagnitude: 5.6,
        largeCount: 2,
      },
      {
        id: "noaa-space-weather",
        status: "healthy",
        fallbackUsed: false,
        fetchedSeedCount: 180,
        freshSeedCount: 1,
        staleSeedCount: 0,
        latestKp: 4,
        recentPeakKp: 5,
        alertLevel: "storm",
      },
    ],
    launchItems: [
      {
        startsAt: "2099-04-01T00:00:00.000Z",
        rightsProfile: "public-information",
      },
      {
        startsAt: "2099-04-08T00:00:00.000Z",
        rightsProfile: "public-information",
      },
    ],
    earthquakeItems: [
      {
        startsAt: "2099-04-01T00:00:00.000Z",
        rightsProfile: "public-information",
        status: "monitoring",
      },
    ],
    spaceWeatherItems: [
      {
        startsAt: "2099-04-01T00:00:00.000Z",
        rightsProfile: "public-information",
        status: "monitoring",
      },
    ],
    degradedReasons: [],
  });

  assert.equal(sources.length, 3);
  assert.equal(sources[0].fallbackUsed, true);
  assert.equal(sources[0].freshSeedCount, 2);
  assert.equal(sources[0].status, "healthy");
  assert.equal(sources[1].id, "usgs-earthquakes");
  assert.equal(sources[1].strongestMagnitude, 5.6);
  assert.equal(sources[1].monitoringItemCount, 1);
  assert.equal(sources[2].id, "noaa-space-weather");
  assert.equal(sources[2].recentPeakKp, 5);
  assert.equal(sources[2].alertLevel, "storm");
});

test("getEarthquakeDegradedReasons flags missing monitoring events", () => {
  const reasons = getEarthquakeDegradedReasons([]);

  assert.deepEqual(reasons, ["earthquake topic has no source-backed monitoring event"]);
});

test("getSpaceWeatherDegradedReasons flags missing space-weather monitoring events", () => {
  const reasons = getSpaceWeatherDegradedReasons([]);

  assert.deepEqual(reasons, ["space weather topic has no source-backed monitoring event"]);
});

test("rollForwardSourceHistory marks a source stable after enough healthy non-fallback runs", () => {
  const history = rollForwardSourceHistory({
    previousHistory: {
      sources: [
        {
          id: "nasa-launch-schedule",
          recentRuns: [
            {
              checkedAt: "2026-03-27T00:00:00.000Z",
              status: "healthy",
              fallbackUsed: false,
              freshSeedCount: 3,
            },
            {
              checkedAt: "2026-03-26T00:00:00.000Z",
              status: "healthy",
              fallbackUsed: false,
              freshSeedCount: 3,
            },
          ],
        },
      ],
    },
    checkedAt: "2026-03-28T00:00:00.000Z",
    sources: [
      {
        id: "nasa-launch-schedule",
        status: "healthy",
        fallbackUsed: false,
        freshSeedCount: 3,
      },
    ],
    thresholds: {
      historyLimit: 14,
      minimumStableRuns: 3,
    },
  });

  assert.equal(history.allSourcesStable, true);
  assert.equal(history.sources[0].healthyStreak, 3);
  assert.equal(history.sources[0].nonFallbackStreak, 3);
  assert.equal(history.sources[0].stable, true);
});

test("countConsecutive stops when a run breaks the predicate", () => {
  assert.equal(
    countConsecutive(
      [
        { healthy: true },
        { healthy: true },
        { healthy: false },
      ],
      (run) => run.healthy,
    ),
    2,
  );
});
