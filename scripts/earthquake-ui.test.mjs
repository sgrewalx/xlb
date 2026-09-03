import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  computeEarthquakeReturnDelta,
  filterAndSortEarthquakes,
  readEarthquakeVisit,
  writeEarthquakeVisit,
} from "../src/lib/earthquake-utils.js";

const events = [
  { id: "recent-small", magnitude: 2.8, depthKm: 8, occurredAt: "2026-09-03T04:00:00.000Z", place: "Small Ridge" },
  { id: "older-large", magnitude: 5.4, depthKm: 80, occurredAt: "2026-09-03T02:00:00.000Z", place: "Large Ridge" },
  { id: "middle-medium", magnitude: 4.2, depthKm: 12, occurredAt: "2026-09-03T03:00:00.000Z", place: "Medium Ridge" },
];

test("earthquake UI helpers filter and sort without mutating source events", () => {
  const originalIds = events.map((event) => event.id);
  assert.deepEqual(filterAndSortEarthquakes([...events], "m4", "newest").map((event) => event.id), ["middle-medium", "older-large"]);
  assert.deepEqual(filterAndSortEarthquakes([...events], "m5", "magnitude").map((event) => event.id), ["older-large"]);
  assert.deepEqual(filterAndSortEarthquakes([...events], "all", "depth").map((event) => event.id), ["recent-small", "middle-medium", "older-large"]);
  assert.deepEqual(events.map((event) => event.id), originalIds);
});

test("return delta reports only unseen events and identifies the strongest new event", () => {
  const delta = computeEarthquakeReturnDelta(events, {
    visitedAt: "2026-09-03T01:00:00.000Z",
    eventIds: ["recent-small"],
  });
  assert.equal(delta.newCount, 2);
  assert.equal(delta.newM4Plus, 2);
  assert.equal(delta.strongestNew.id, "older-large");
  assert.equal(computeEarthquakeReturnDelta(events, null), null);
});

test("earthquake visit storage retains only timestamp and compact event IDs", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
  };
  writeEarthquakeVisit(storage, "2026-09-03T06:00:00.000Z", events);
  assert.deepEqual(readEarthquakeVisit(storage), {
    visitedAt: "2026-09-03T06:00:00.000Z",
    eventIds: ["recent-small", "older-large", "middle-medium"],
  });
  assert.deepEqual(Object.keys(JSON.parse([...memory.values()][0])).sort(), ["eventIds", "visitedAt"]);
});

test("earthquake analytics identifiers remain stable", async () => {
  const source = await readFile(new URL("../src/lib/analytics.ts", import.meta.url), "utf8");
  for (const eventName of [
    "earthquake_map_interaction",
    "earthquake_filter_change",
    "earthquake_event_open",
    "earthquake_usgs_click",
    "earthquake_return_delta_view",
  ]) {
    assert.match(source, new RegExp(`trackEvent\\(\\"${eventName}\\"`));
  }
  assert.doesNotMatch(source, /user_location|latitude|longitude/);
});
