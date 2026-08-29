import assert from "node:assert/strict";
import test from "node:test";
import {
  getConsumerMetric,
  getGalleryCategories,
  getGalleryDiscoveryItems,
} from "../src/lib/galleryPresentation.ts";

function entry(metricLabel, metricValue, id = metricLabel.toLowerCase().replaceAll(" ", "-")) {
  return {
    id,
    title: id,
    summary: "Summary",
    metricLabel,
    metricValue,
    href: `/topics/${id}`,
    accent: "signal",
  };
}

function collection(id, category, entries) {
  return {
    id,
    title: id,
    description: "Description",
    category,
    relatedPath: "/live",
    relatedLabel: "Open live",
    entries,
  };
}

test("Gallery exposes only useful non-zero temporal metrics", () => {
  assert.deepEqual(getConsumerMetric(entry("Updated", "Aug 29, 05:00 AM")), {
    label: "Updated",
    value: "Aug 29, 05:00 AM",
  });
  assert.deepEqual(getConsumerMetric(entry("Countdown", "Starting")), {
    label: "Countdown",
    value: "Starting",
  });
  assert.equal(getConsumerMetric(entry("Updated", "0")), null);
});

test("Gallery suppresses internal optimization and traffic metrics", () => {
  for (const label of [
    "Pageviews",
    "Space views",
    "Promoted",
    "Best score",
    "Event count",
    "Live pages",
    "Traffic score",
  ]) {
    assert.equal(getConsumerMetric(entry(label, "96")), null, `${label} should be suppressed`);
  }
});

test("Gallery filters derive from every collection in manifest order", () => {
  const items = [
    collection("earth", "quake", [entry("Updated", "Now", "earth-entry")]),
    collection("aurora", "aurora", [entry("Pageviews", "1", "aurora-entry")]),
    collection("launches", "launch", [entry("Countdown", "Soon", "launch-entry")]),
    collection("topics", "topic", [entry("Best score", "80", "topic-entry")]),
  ];

  assert.deepEqual(getGalleryCategories(items), ["quake", "aurora", "launch", "topic"]);
  assert.deepEqual(
    getGalleryDiscoveryItems(items, "all").map(({ entry: item }) => item.id),
    ["aurora-entry", "launch-entry", "topic-entry"],
  );
  assert.deepEqual(
    getGalleryDiscoveryItems(items, "quake").map(({ entry: item }) => item.id),
    ["earth-entry"],
  );
});
