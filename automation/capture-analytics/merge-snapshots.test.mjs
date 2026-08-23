import test from "node:test";
import assert from "node:assert/strict";
import { mergeSnapshots } from "./merge-snapshots.mjs";

test("merged analytics preserves GA4 diagnostic status", () => {
  const ga4 = {
    capturedAt: "2026-08-23T06:00:00.000Z",
    window: { start: "2026-08-16T00:00:00.000Z", end: "2026-08-23T00:00:00.000Z" },
    sources: { ga4: true },
    ga4: {
      propertyId: "530268584",
      streamVerified: true,
      stream: {
        name: "properties/530268584/dataStreams/1",
        streamId: "1",
        type: "WEB_DATA_STREAM",
        displayName: "XLB",
        measurementId: "G-5JECBDGEMT",
        defaultUri: "https://xlb.codemachine.in",
      },
      rowCount: 0,
      totals: { totalUsers: 0, sessions: 0, screenPageViews: 0, eventCount: 0 },
      dataStatus: "no-events-observed",
    },
    pages: [],
  };
  const searchConsole = {
    capturedAt: "2026-08-23T06:00:00.000Z",
    window: ga4.window,
    sources: { searchConsole: true },
    pages: [{
      path: "/",
      pageviews: 0,
      visits: 0,
      searchImpressions: 2,
      searchCtr: 0,
      avgPosition: 4.5,
      watchClicks: 0,
      revenueUsd: 0,
      engagementScore: 0,
      decision: "review",
    }],
  };

  const merged = mergeSnapshots([ga4, searchConsole]);
  assert.deepEqual(merged.ga4, ga4.ga4);
  assert.equal(merged.pages.length, 1);
  assert.notEqual(merged.ga4, ga4.ga4);
});
