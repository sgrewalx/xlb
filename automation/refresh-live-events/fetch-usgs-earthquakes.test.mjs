import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildEarthquakeWatchItem,
  fetchUsgsEarthquakePackage,
  parseEarthquakeFeed,
  roundMagnitude,
  toIsoOrNow,
} from "./fetch-usgs-earthquakes.mjs";
import {
  buildEarthquakeManifest,
  normalizeUsgsEvent,
  validateEarthquakeManifest,
} from "./earthquake-manifest.mjs";
import { persistEarthquakeManifest } from "./run.mjs";

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

test("USGS event normalization retains coordinates, depth, magnitude, and optional values", async () => {
  const json = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const event = normalizeUsgsEvent(json.features[0]);

  assert.deepEqual(event, {
    id: "us7000abcd",
    magnitude: 5.6,
    place: "87 km SE of Pondaguitan, Philippines",
    occurredAt: "2026-04-01T03:50:00.000Z",
    updatedAt: "2026-04-01T04:00:00.000Z",
    latitude: 5.92,
    longitude: 126.84,
    depthKm: 42.3,
    tsunami: false,
    significance: 482,
    felt: 12,
    alert: "green",
    status: "reviewed",
    url: "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
  });

  const withoutOptionalValues = structuredClone(json.features[1]);
  delete withoutOptionalValues.properties.updated;
  assert.equal(normalizeUsgsEvent(withoutOptionalValues).felt, null);
  assert.equal(normalizeUsgsEvent(withoutOptionalValues).alert, null);
  assert.equal(
    normalizeUsgsEvent(withoutOptionalValues).updatedAt,
    normalizeUsgsEvent(withoutOptionalValues).occurredAt,
  );
});

test("signed USGS depths survive normalization, aggregation, validation, and trends", async () => {
  const currentFeed = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const weeklyFeed = JSON.parse(
    await readFile(new URL("./fixtures/usgs-all-week.geojson", import.meta.url), "utf8"),
  );
  currentFeed.features[0].geometry.coordinates[2] = -0.8;

  const normalized = normalizeUsgsEvent(currentFeed.features[0]);
  assert.equal(normalized.depthKm, -0.8);

  const manifest = buildEarthquakeManifest({ currentFeed, weeklyFeed });
  assert.equal(manifest.events.find((event) => event.id === normalized.id).depthKm, -0.8);
  assert.equal(manifest.summary.total, 3);
  assert.equal(manifest.summary.shallowCount, 2);
  assert.equal(manifest.summary.medianDepthKm, 2.1);
  assert.equal(manifest.trends.magnitudeBands.reduce((sum, band) => sum + band.count, 0), 3);
  assert.equal(manifest.trends.threeHourBuckets.reduce((sum, bucket) => sum + bucket.count, 0), 3);
  assert.equal(validateEarthquakeManifest(manifest), manifest);

  const schema = JSON.parse(await readFile(
    new URL("../contracts/earthquake-current.schema.json", import.meta.url),
    "utf8",
  ));
  assert.equal(schema.$defs.event.properties.depthKm.minimum, undefined);
  assert.equal(schema.$defs.summary.properties.medianDepthKm.minimum, undefined);
});

test("earthquake manifest computes current summary, trends, strongest event, and six-day baseline", async () => {
  const currentFeed = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const weeklyFeed = JSON.parse(
    await readFile(new URL("./fixtures/usgs-all-week.geojson", import.meta.url), "utf8"),
  );
  const manifest = buildEarthquakeManifest({ currentFeed, weeklyFeed });

  assert.deepEqual(manifest.summary, {
    total: 3,
    m4Plus: 2,
    m5Plus: 1,
    shallowCount: 2,
    medianDepthKm: 42.3,
    strongestMagnitude: 5.6,
    strongestEventId: "us7000abcd",
  });
  assert.deepEqual(manifest.baseline.dailyAverage, { total: 1, m4Plus: 0.7, m5Plus: 0.2 });
  assert.deepEqual(manifest.baseline.differenceFromAverage, { total: 2, m4Plus: 1.3, m5Plus: 0.8 });
  assert.equal(manifest.trends.magnitudeBands.reduce((sum, band) => sum + band.count, 0), 3);
  assert.equal(manifest.trends.threeHourBuckets.reduce((sum, bucket) => sum + bucket.count, 0), 3);
  assert.deepEqual(manifest.events.map((event) => event.id), ["us7000abcd", "us7000abce", "nc7000abcf"]);
  assert.equal(validateEarthquakeManifest(manifest), manifest);
});

test("malformed and empty USGS feeds fail closed", async () => {
  const currentFeed = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const weeklyFeed = JSON.parse(
    await readFile(new URL("./fixtures/usgs-all-week.geojson", import.meta.url), "utf8"),
  );
  const malformed = structuredClone(currentFeed);
  malformed.features[0].geometry.coordinates = [999, 0, 2];
  malformed.features = [malformed.features[0]];

  assert.throws(
    () => buildEarthquakeManifest({ currentFeed: malformed, weeklyFeed }),
    /no valid earthquake events/,
  );
  assert.throws(
    () => buildEarthquakeManifest({ currentFeed: { ...currentFeed, features: [] }, weeklyFeed }),
    /no valid earthquake events/,
  );
});

test("explicit fixtures can publish while source failure preserves last-known-good content", async () => {
  const fixtureDirectory = new URL("./fixtures/", import.meta.url).pathname;
  const fixtureResult = await fetchUsgsEarthquakePackage({ fixtureDir: fixtureDirectory });
  assert.equal(fixtureResult.sourceMode, "fixture");
  assert.equal(fixtureResult.manifestPublishable, true);

  const fallbackResult = await fetchUsgsEarthquakePackage({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    },
    fixtureDir: "",
  });
  assert.equal(fallbackResult.sourceMode, "bundled-fallback");
  assert.equal(fallbackResult.manifestPublishable, false);

  const directory = await mkdtemp(path.join(tmpdir(), "xlb-earthquake-lkg-"));
  const filePath = path.join(directory, "current.json");
  await writeFile(filePath, '{"lastKnownGood":true}\n', "utf8");
  try {
    const changed = await persistEarthquakeManifest({
      fileUrl: new URL(`file://${filePath}`),
      manifest: fallbackResult.manifest,
      publishable: fallbackResult.manifestPublishable,
    });
    assert.equal(changed, false);
    assert.equal(await readFile(filePath, "utf8"), '{"lastKnownGood":true}\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
