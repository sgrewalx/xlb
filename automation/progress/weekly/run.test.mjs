import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildWeeklyProgress, renderWeeklyMarkdown } from "./run.mjs";

const queue = JSON.parse(await readFile(new URL("../../experiments/queue.json", import.meta.url), "utf8"));
const snapshot = {
  capturedAt: "2026-09-06T06:00:00.000Z", window: { start: "2026-08-30T00:00:00.000Z", end: "2026-09-06T00:00:00.000Z" },
  ga4: { dataStatus: "data", totals: { totalUsers: 3, sessions: 6, screenPageViews: 37, eventCount: 75 } },
  pages: [
    { path: "/news", pageviews: 10, returnVisitors: 2, videoStarts: 0, gameStarts: 0, galleryOpens: 0, liveCardClicks: 0, searchImpressions: 5, searchCtr: 0.2, notes: "GA4 Data API Search Console API" },
    { path: "/events/global-earthquake-watch", pageviews: 2, returnVisitors: 1, videoStarts: 0, gameStarts: 0, galleryOpens: 0, liveCardClicks: 0, searchImpressions: 0, searchCtr: 0, notes: "GA4 Data API" },
  ],
};

test("first weekly record preserves unavailable data and has no invented deltas", () => {
  const record = buildWeeklyProgress({ snapshot, queue, previous: null });
  assert.equal(record.week, "2026-W36");
  assert.equal(record.search.impressions, 5);
  assert.equal(record.search.clicks, 1);
  assert.equal(record.search.visiblePages, 1);
  assert.equal(record.product.earthquakeInteractions, null);
  assert.equal(record.releases.deployments, null);
  assert.equal(record.weekOverWeek.traffic.users, null);
  assert.match(renderWeeklyMarkdown(record), /Earthquake interactions: Unavailable/);
});

test("weekly record calculates numeric deltas and supported deployment counts", () => {
  const previous = buildWeeklyProgress({ snapshot: { ...snapshot, ga4: { ...snapshot.ga4, totals: { ...snapshot.ga4.totals, totalUsers: 2 } } }, queue });
  const record = buildWeeklyProgress({ snapshot, queue, previous, releases: [{ classification: "content-only" }, { classification: "review-required" }] });
  assert.equal(record.weekOverWeek.traffic.users, 1);
  assert.deepEqual(record.releases, { deployments: 2, contentOnlyDeployments: 1, supervisedDeployments: 1 });
});
