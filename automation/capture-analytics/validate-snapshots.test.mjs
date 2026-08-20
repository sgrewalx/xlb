import test from "node:test";
import assert from "node:assert/strict";
import { validateAnalyticsSnapshotSet } from "./validate-snapshots.mjs";

function snapshot(source) {
  return {
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
}

test("analytics snapshot set accepts valid empty page arrays", () => {
  assert.doesNotThrow(() => validateAnalyticsSnapshotSet({
    ga4: snapshot("ga4"),
    searchConsole: snapshot("searchConsole"),
    merged: snapshot("merged"),
  }));
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
