import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  computeEarthquakeReturnDelta,
  createEarthquakeVisitSession,
  filterAndSortEarthquakes,
  readEarthquakeVisit,
  writeEarthquakeVisit,
} from "../src/lib/earthquake-utils.js";

const events = [
  { id: "recent-small", magnitude: 2.8, depthKm: -0.8, occurredAt: "2026-09-03T04:00:00.000Z", place: "Small Ridge" },
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

test("first visit stays a first visit across polling and persists only once", () => {
  const { storage, writes } = memoryStorage();
  const session = createEarthquakeVisitSession(storage, { mountedAt: "2026-09-03T05:59:00.000Z" });

  assert.equal(session.priorVisitAtMount, null);
  const first = session.recordManifest(events);
  assert.deepEqual(first, { delta: null, shouldTrack: false, didPersist: true });

  const polledEvents = [
    { id: "arrived-during-session", magnitude: 4.7, depthKm: 6, occurredAt: "2026-09-03T05:00:00.000Z", place: "Polling Ridge" },
    ...events,
  ];
  const polled = session.recordManifest(polledEvents);
  assert.deepEqual(polled, { delta: null, shouldTrack: false, didPersist: false });
  assert.equal(writes.length, 1);
  assert.equal(JSON.parse(writes[0].value).visitedAt, "2026-09-03T05:59:00.000Z");
});

test("second visit measures against the mount baseline once despite polling", () => {
  const { storage, writes } = memoryStorage();
  const firstVisit = createEarthquakeVisitSession(storage, {
    mountedAt: "2026-09-02T06:00:00.000Z",
  });
  firstVisit.recordManifest([events[0]]);

  const session = createEarthquakeVisitSession(storage, {
    mountedAt: "2026-09-03T05:59:00.000Z",
  });
  const first = session.recordManifest(events);

  assert.equal(first.delta.previousVisitAt, "2026-09-02T06:00:00.000Z");
  assert.equal(first.delta.newCount, 2);
  assert.equal(first.shouldTrack, true);
  assert.equal(first.didPersist, true);

  const polled = session.recordManifest([
    { id: "arrived-during-session", magnitude: 6.1, depthKm: 4, occurredAt: "2026-09-03T05:00:00.000Z", place: "Polling Ridge" },
    ...events,
  ]);
  assert.deepEqual(polled.delta, first.delta);
  assert.equal(polled.shouldTrack, false);
  assert.equal(polled.didPersist, false);
  assert.equal(writes.length, 2);
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

function memoryStorage(previousVisit) {
  const memory = new Map();
  if (previousVisit) {
    memory.set("xlb:earthquake-intelligence:last-visit", JSON.stringify(previousVisit));
  }
  const writes = [];
  return {
    writes,
    storage: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        writes.push({ key, value });
        memory.set(key, value);
      },
    },
  };
}
