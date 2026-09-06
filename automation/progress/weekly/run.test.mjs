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
function sourceSnapshots({ searchStart = "2026-08-08T00:00:00.000Z", searchEnd = "2026-09-05T00:00:00.000Z", trafficStart = "2026-08-30T00:00:00.000Z", trafficEnd = "2026-09-06T00:00:00.000Z" } = {}) {
  return {
    ga4: { capturedAt: snapshot.capturedAt, window: { start: trafficStart, end: trafficEnd }, ga4: snapshot.ga4, pages: snapshot.pages.filter((page) => page.notes.includes("GA4")) },
    searchConsole: { capturedAt: snapshot.capturedAt, window: { start: searchStart, end: searchEnd }, pages: snapshot.pages.filter((page) => page.notes.includes("Search Console")) },
  };
}

test("first weekly record preserves unavailable data and has no invented deltas", () => {
  const record = buildWeeklyProgress({ snapshot, sourceSnapshots: sourceSnapshots(), queue, previous: null });
  assert.equal(record.week, "2026-W36");
  assert.equal(record.search.impressions, 5);
  assert.equal(record.search.clicks, 1);
  assert.equal(record.search.visiblePages, 1);
  assert.equal(record.product.earthquakeInteractions, null);
  assert.equal(record.releases.deployments, null);
  assert.equal(record.weekOverWeek.traffic.users, null);
  assert.equal(record.periods.traffic.start, "2026-08-30T00:00:00.000Z");
  assert.equal(record.periods.search.start, "2026-08-08T00:00:00.000Z");
  assert.equal(record.periods.search.comparableToPrevious, false);
  assert.match(renderWeeklyMarkdown(record), /2026-08-08T00:00:00.000Z to 2026-09-05T00:00:00.000Z/);
  assert.match(renderWeeklyMarkdown(record), /Earthquake interactions: Unavailable/);
});

test("weekly record calculates numeric deltas and supported deployment counts", () => {
  const previousSources = sourceSnapshots({ trafficStart: "2026-08-23T00:00:00.000Z", trafficEnd: "2026-08-30T00:00:00.000Z", searchStart: "2026-08-23T00:00:00.000Z", searchEnd: "2026-08-30T00:00:00.000Z" });
  previousSources.ga4.ga4 = { ...snapshot.ga4, totals: { ...snapshot.ga4.totals, totalUsers: 2 } };
  const previous = buildWeeklyProgress({ snapshot: { ...snapshot, capturedAt: "2026-08-30T06:00:00.000Z" }, sourceSnapshots: previousSources, queue });
  const currentSources = sourceSnapshots({ searchStart: "2026-08-30T00:00:00.000Z", searchEnd: "2026-09-06T00:00:00.000Z" });
  const record = buildWeeklyProgress({ snapshot, sourceSnapshots: currentSources, queue, previous, releases: [{ classification: "content-only" }, { classification: "review-required" }] });
  assert.equal(record.weekOverWeek.traffic.users, 1);
  assert.equal(record.weekOverWeek.search.impressions, 0);
  assert.deepEqual(record.releases, { deployments: 2, contentOnlyDeployments: 1, supervisedDeployments: 1 });
});

test("overlapping and missing previous search periods never invent a delta", () => {
  const previous = buildWeeklyProgress({ snapshot, sourceSnapshots: sourceSnapshots({ searchStart: "2026-08-01T00:00:00.000Z", searchEnd: "2026-08-29T00:00:00.000Z" }), queue });
  const overlapping = buildWeeklyProgress({ snapshot, sourceSnapshots: sourceSnapshots(), queue, previous });
  assert.equal(overlapping.periods.search.comparableToPrevious, false);
  assert.equal(overlapping.weekOverWeek.search.impressions, null);
  const noPrevious = buildWeeklyProgress({ snapshot, sourceSnapshots: sourceSnapshots(), queue, previous: null });
  assert.equal(noPrevious.weekOverWeek.search.impressions, null);
});

test("ops dashboard exposes source-specific periods and experiment evidence state", async () => {
  const source = await readFile(new URL("../../../src/pages/OpsDashboardPage.tsx", import.meta.url), "utf8");
  assert.match(source, /Traffic: \{period\(current\.periods\?\.traffic\)\}/);
  assert.match(source, /Search: \{period\(current\.periods\?\.search\)\}/);
  assert.match(source, /item\.measurement\?\.evidenceState/);
  assert.match(source, /GA4 period/);
  assert.match(source, /Search period/);
});
