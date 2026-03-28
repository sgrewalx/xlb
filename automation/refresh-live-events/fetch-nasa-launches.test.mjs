import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildLaunchItem,
  extractTitle,
  inferStartsAt,
  looksLikeLaunchScheduleEntry,
  parseLaunchScheduleHtml,
} from "./fetch-nasa-launches.mjs";

const fixtureUrl = new URL("./fixtures/nasa-launch-schedule.html", import.meta.url);

test("parseLaunchScheduleHtml extracts clean NASA launch entries from fixture", async () => {
  const html = await readFile(fixtureUrl, "utf8");
  const items = parseLaunchScheduleHtml(html);

  assert.equal(items.length, 3);
  assert.equal(items[0].title, "Artemis II");
  assert.equal(items[0].slug, "artemis-ii");
  assert.equal(items[0].startsAt, "2026-04-01T18:24:00.000Z");
  assert.equal(items[1].title, "NASA’s Northrop Grumman CRS-24");
  assert.equal(items[1].startsAt, "2026-04-08T12:00:00.000Z");
  assert.equal(items[2].title, "NASA’s SpaceX CRS-34");
});

test("looksLikeLaunchScheduleEntry rejects noisy article-like links", () => {
  assert.equal(
    looksLikeLaunchScheduleEntry(
      "3 min read Track NASA’s Artemis II Mission in Real Time article 3 weeks ago",
      "https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/",
    ),
    false,
  );
});

test("extractTitle removes the leading schedule date prefix", () => {
  assert.equal(
    extractTitle("No Earlier Than April 8,2026 NASA’s Northrop Grumman CRS-24"),
    "NASA’s Northrop Grumman CRS-24",
  );
});

test("inferStartsAt handles date-only schedule entries", () => {
  assert.equal(
    inferStartsAt("No Earlier Than April 8,2026 NASA’s Northrop Grumman CRS-24"),
    "2026-04-08T12:00:00.000Z",
  );
});

test("buildLaunchItem creates a source-backed upcoming event", () => {
  const item = buildLaunchItem(
    "No Earlier Than April 1, 2026 6:24 pm Artemis II",
    "https://www.nasa.gov/event/artemis-ii-launch/",
    0,
  );

  assert.ok(item);
  assert.equal(item.status, "upcoming");
  assert.equal(item.topic, "launches");
  assert.equal(item.sourceName, "NASA Launch Schedule");
});
