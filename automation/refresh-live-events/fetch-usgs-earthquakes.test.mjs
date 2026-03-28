import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildEarthquakeWatchItem,
  parseEarthquakeFeed,
  roundMagnitude,
  toIsoOrNow,
} from "./fetch-usgs-earthquakes.mjs";

const fixtureUrl = new URL("./fixtures/usgs-all-day.geojson", import.meta.url);

test("parseEarthquakeFeed builds a source-backed earthquake watch item from fixture data", async () => {
  const json = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const { items, stats } = parseEarthquakeFeed(json);

  assert.equal(items.length, 1);
  assert.equal(items[0].slug, "global-earthquake-watch");
  assert.equal(items[0].category, "earth");
  assert.match(items[0].summary, /USGS reported 3 earthquake events/);
  assert.equal(stats.featureCount, 3);
  assert.equal(stats.largeCount, 2);
  assert.equal(stats.strongestMagnitude, 5.6);
});

test("buildEarthquakeWatchItem promotes strong earthquake days more aggressively", () => {
  const item = buildEarthquakeWatchItem({
    featureCount: 9,
    largeCount: 1,
    strongestMagnitude: 6.2,
    strongestPlace: "Mindanao, Philippines",
    feedUpdatedAt: "2026-03-28T00:00:00.000Z",
    mostRecentEventAt: "2026-03-27T23:58:00.000Z",
  });

  assert.equal(item.heroPriority, 94);
  assert.equal(item.status, "monitoring");
  assert.match(item.summary, /M6.2 near Mindanao, Philippines/);
});

test("roundMagnitude and toIsoOrNow normalize feed values", () => {
  assert.equal(roundMagnitude(4.66), 4.7);
  assert.equal(toIsoOrNow(1775017200000), "2026-04-01T04:20:00.000Z");
});
