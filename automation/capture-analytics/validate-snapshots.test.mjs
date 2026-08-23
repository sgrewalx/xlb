import test from "node:test";
import assert from "node:assert/strict";
import { validateAnalyticsSnapshotSet } from "./validate-snapshots.mjs";

function snapshot(source) {
  const value = {
    capturedAt: "2026-08-20T03:00:00.000Z",
    window: {
      start: "2026-08-13T00:00:00.000Z",
      end: "2026-08-20T00:00:00.000Z",
    },
    sources: {
      ga4: source === "ga4" || source === "merged",
      searchConsole: source === "searchConsole" || source === "merged",
    },
    pages: [],
  };
  if (source === "ga4" || source === "merged") {
    value.ga4 = ga4Diagnostics();
  }
  return value;
}

function ga4Diagnostics(overrides = {}) {
  return {
    propertyId: "530268584",
    streamVerified: true,
    stream: {
      name: "properties/530268584/dataStreams/123",
      streamId: "123",
      type: "WEB_DATA_STREAM",
      displayName: "XLB",
      measurementId: "G-5JECBDGEMT",
      defaultUri: "https://xlb.codemachine.in",
    },
    rowCount: 0,
    totals: {
      totalUsers: 0,
      sessions: 0,
      screenPageViews: 0,
      eventCount: 0,
    },
    dataStatus: "no-events-observed",
    ...overrides,
  };
}

test("analytics snapshot set accepts valid empty page arrays", () => {
  assert.doesNotThrow(() => validateAnalyticsSnapshotSet({
    ga4: snapshot("ga4"),
    searchConsole: snapshot("searchConsole"),
    merged: snapshot("merged"),
  }));
});

test("verified zero GA4 snapshot requires zero totals and zero rows", () => {
  const ga4 = snapshot("ga4");
  const merged = snapshot("merged");
  ga4.ga4.totals.eventCount = 1;
  merged.ga4.totals.eventCount = 1;

  assert.throws(
    () => validateAnalyticsSnapshotSet({ ga4, searchConsole: snapshot("searchConsole"), merged }),
    /requires zero totals/,
  );
});

test("missing or mismatched GA4 identity fails closed", () => {
  const ga4 = snapshot("ga4");
  const merged = snapshot("merged");
  ga4.ga4.streamVerified = false;
  merged.ga4.streamVerified = false;

  assert.throws(
    () => validateAnalyticsSnapshotSet({ ga4, searchConsole: snapshot("searchConsole"), merged }),
    /stream must be verified/,
  );
});

test("GA4 diagnostics require an exact numeric stream ID binding", () => {
  const ga4 = snapshot("ga4");
  const merged = snapshot("merged");
  ga4.ga4.stream.streamId = "999";
  merged.ga4.stream.streamId = "999";

  assert.throws(
    () => validateAnalyticsSnapshotSet({ ga4, searchConsole: snapshot("searchConsole"), merged }),
    /stream does not belong/,
  );
});

test("merged snapshot must preserve source GA4 diagnostics", () => {
  const ga4 = snapshot("ga4");
  const merged = snapshot("merged");
  merged.ga4.propertyId = "999";

  assert.throws(
    () => validateAnalyticsSnapshotSet({ ga4, searchConsole: snapshot("searchConsole"), merged }),
    /stream does not belong|must match/,
  );
});

test("analytics snapshot set rejects incomplete merged provenance", () => {
  const merged = snapshot("merged");
  merged.sources.searchConsole = false;

  assert.throws(
    () => validateAnalyticsSnapshotSet({
      ga4: snapshot("ga4"),
      searchConsole: snapshot("searchConsole"),
      merged,
    }),
    /searchConsole source must be enabled/,
  );
});
