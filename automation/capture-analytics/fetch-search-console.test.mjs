import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchSearchConsoleDatasets,
  normalizeQueryRow,
} from "./fetch-search-console.mjs";
import { normalizeSearchConsoleQuerySnapshot } from "./import-search-console.mjs";
import { validateSearchConsoleQuerySnapshot } from "./validate-snapshots.mjs";

const window = {
  capturedAt: "2026-09-03T06:00:00.000Z",
  startDate: "2026-08-26",
  endDate: "2026-09-01",
  startIso: "2026-08-26T00:00:00.000Z",
  endExclusiveIso: "2026-09-02T00:00:00.000Z",
};

test("Search Console capture keeps page and query datasets separate", async () => {
  const requests = [];
  const queryRunner = async (request) => {
    requests.push(request.body);
    return request.body.dimensions.length === 1
      ? [{ keys: ["https://xlb.codemachine.in/events/global-earthquake-watch"], impressions: 3, clicks: 1, ctr: 1 / 3, position: 8 }]
      : [{ keys: ["recent global earthquakes", "https://xlb.codemachine.in/events/global-earthquake-watch"], impressions: 2, clicks: 1, ctr: 0.5, position: 6.5 }];
  };

  const result = await fetchSearchConsoleDatasets("sc-domain:xlb.codemachine.in", {
    accessToken: "test-token",
    queryRunner,
    window,
  });

  assert.deepEqual(requests.map((request) => request.dimensions), [["page"], ["query", "page"]]);
  assert.equal(result.pageSnapshot.pages[0].path, "/events/global-earthquake-watch");
  assert.deepEqual(result.querySnapshot.rows[0], {
    query: "recent global earthquakes",
    path: "/events/global-earthquake-watch",
    clicks: 1,
    impressions: 2,
    ctr: 0.5,
    position: 6.5,
  });
  validateSearchConsoleQuerySnapshot(result.querySnapshot);
});

test("query normalization handles absolute paths and missing metrics deterministically", () => {
  assert.deepEqual(normalizeQueryRow({
    keys: ["  live earthquake map  ", "https://xlb.codemachine.in/events/global-earthquake-watch?src=search"],
  }), {
    query: "live earthquake map",
    path: "/events/global-earthquake-watch",
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  });
});

test("zero query rows are valid and remain private from the page snapshot", async () => {
  const result = await fetchSearchConsoleDatasets("sc-domain:xlb.codemachine.in", {
    accessToken: "test-token",
    queryRunner: async () => [],
    window,
  });
  assert.deepEqual(result.querySnapshot.rows, []);
  assert.equal("rows" in result.pageSnapshot, false);
  validateSearchConsoleQuerySnapshot(result.querySnapshot);
});

test("import fallback emits the same query snapshot contract", () => {
  const pageSnapshot = {
    capturedAt: window.capturedAt,
    window: { start: window.startIso, end: window.endExclusiveIso },
    sources: { cloudflare: false, searchConsole: true, ga4: false, adsense: false },
  };
  const snapshot = normalizeSearchConsoleQuerySnapshot({
    queryRows: [{
      query: "earthquake map",
      path: "https://xlb.codemachine.in/events/global-earthquake-watch",
      clicks: 0,
      impressions: 4,
      ctr: 0,
      position: 11.25,
    }],
  }, pageSnapshot);
  assert.equal(snapshot.rows[0].path, "/events/global-earthquake-watch");
  validateSearchConsoleQuerySnapshot(snapshot);
});
