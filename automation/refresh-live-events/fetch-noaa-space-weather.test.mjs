import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAuroraWatchItem,
  inferAlertLevel,
  parseKpFeed,
  roundKp,
  toIsoOrNow,
} from "./fetch-noaa-space-weather.mjs";

const fixtureUrl = new URL("./fixtures/noaa-kp-index.json", import.meta.url);

test("parseKpFeed builds an aurora watch item from NOAA Kp data", async () => {
  const json = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const { items, stats } = parseKpFeed(json);

  assert.equal(items.length, 1);
  assert.equal(items[0].slug, "aurora-watch");
  assert.equal(items[0].topic, "space-weather");
  assert.equal(stats.sampleCount, 5);
  assert.equal(stats.latestKp, 4);
  assert.equal(stats.recentPeakKp, 5);
  assert.equal(stats.alertLevel, "storm");
});

test("buildAuroraWatchItem raises hero priority during storm conditions", () => {
  const item = buildAuroraWatchItem({
    sampleCount: 120,
    latestKp: 4.3,
    recentPeakKp: 5.7,
    alertLevel: "storm",
    updatedAt: "2026-03-28T00:04:00.000Z",
  });

  assert.equal(item.heroPriority, 95);
  assert.match(item.summary, /Geomagnetic storm conditions reached Kp 4.3|Current geomagnetic conditions are near Kp 4.3/);
});

test("inferAlertLevel and time normalization behave consistently", () => {
  assert.equal(inferAlertLevel(4.2), "active");
  assert.equal(inferAlertLevel(5), "storm");
  assert.equal(roundKp(4.66), 4.7);
  assert.equal(toIsoOrNow("2026-03-28T00:04:00"), "2026-03-28T00:04:00.000Z");
});
