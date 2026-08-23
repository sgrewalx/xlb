import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function validateAnalyticsSnapshot(snapshot, { label, expectedSource }) {
  assert(snapshot && typeof snapshot === "object", `${label}: snapshot must be an object`);
  assert(Number.isFinite(Date.parse(snapshot.capturedAt)), `${label}: capturedAt must be an ISO date`);
  assert(snapshot.window && typeof snapshot.window === "object", `${label}: window is required`);
  assert(Number.isFinite(Date.parse(snapshot.window.start)), `${label}: window.start must be an ISO date`);
  assert(Number.isFinite(Date.parse(snapshot.window.end)), `${label}: window.end must be an ISO date`);
  assert(snapshot.sources && typeof snapshot.sources === "object", `${label}: sources are required`);
  assert(snapshot.sources[expectedSource] === true, `${label}: ${expectedSource} source must be enabled`);
  assert(Array.isArray(snapshot.pages), `${label}: pages must be an array`);

  snapshot.pages.forEach((page, index) => {
    assert(typeof page.path === "string" && page.path.startsWith("/"), `${label}: page ${index} path invalid`);
  });
}

export function validateAnalyticsSnapshotSet({ ga4, searchConsole, merged }) {
  validateAnalyticsSnapshot(ga4, { label: "GA4", expectedSource: "ga4" });
  validateGa4Diagnostics(ga4.ga4, { label: "GA4", pageCount: ga4.pages.length });
  validateAnalyticsSnapshot(searchConsole, {
    label: "Search Console",
    expectedSource: "searchConsole",
  });
  validateAnalyticsSnapshot(merged, { label: "Merged", expectedSource: "ga4" });
  assert(merged.sources.searchConsole === true, "Merged: searchConsole source must be enabled");
  validateGa4Diagnostics(merged.ga4, { label: "Merged" });
  assert(
    JSON.stringify(merged.ga4) === JSON.stringify(ga4.ga4),
    "Merged: GA4 diagnostics must match the source snapshot",
  );
}

export function validateGa4Diagnostics(diagnostics, { label, pageCount } = {}) {
  assert(diagnostics && typeof diagnostics === "object", `${label}: GA4 diagnostics are required`);
  assert(/^\d+$/.test(diagnostics.propertyId ?? ""), `${label}: GA4 propertyId is invalid`);
  assert(diagnostics.streamVerified === true, `${label}: GA4 stream must be verified`);
  assert(diagnostics.stream && typeof diagnostics.stream === "object", `${label}: GA4 stream is required`);
  assert(
    diagnostics.stream.name
      === `properties/${diagnostics.propertyId}/dataStreams/${diagnostics.stream.streamId}`,
    `${label}: GA4 stream does not belong to the property`,
  );
  assert(/^\d+$/.test(diagnostics.stream.streamId ?? ""), `${label}: GA4 streamId is invalid`);
  assert(diagnostics.stream.type === "WEB_DATA_STREAM", `${label}: GA4 stream must be a web stream`);
  assert(/^G-[A-Z0-9]+$/i.test(diagnostics.stream.measurementId ?? ""), `${label}: GA4 measurementId is invalid`);
  assert(
    diagnostics.stream.defaultUri == null || isValidUrl(diagnostics.stream.defaultUri),
    `${label}: GA4 stream defaultUri is invalid`,
  );
  assert(Number.isInteger(diagnostics.rowCount) && diagnostics.rowCount >= 0, `${label}: GA4 rowCount is invalid`);
  assert(diagnostics.totals && typeof diagnostics.totals === "object", `${label}: GA4 totals are required`);

  const totalNames = ["totalUsers", "sessions", "screenPageViews", "eventCount"];
  const totals = totalNames.map((name) => diagnostics.totals[name]);
  assert(
    totals.every((value) => Number.isFinite(value) && value >= 0),
    `${label}: GA4 totals are malformed`,
  );
  assert(
    ["data", "no-events-observed"].includes(diagnostics.dataStatus),
    `${label}: GA4 dataStatus is invalid`,
  );

  if (diagnostics.dataStatus === "no-events-observed") {
    assert(totals.every((value) => value === 0), `${label}: verified zero status requires zero totals`);
    assert(diagnostics.rowCount === 0, `${label}: verified zero status requires zero GA4 rows`);
    if (pageCount !== undefined) {
      assert(pageCount === 0, `${label}: verified zero status requires an empty page array`);
    }
  } else {
    assert(totals.some((value) => value > 0), `${label}: data status requires non-zero totals`);
    assert(diagnostics.rowCount > 0, `${label}: data status requires GA4 rows`);
    if (pageCount !== undefined) {
      assert(pageCount === diagnostics.rowCount, `${label}: GA4 rowCount must match page rows`);
    }
  }
}

function isValidUrl(value) {
  try {
    return Boolean(new URL(value).hostname);
  } catch {
    return false;
  }
}

async function readJson(fileUrl) {
  return JSON.parse(await readFile(fileUrl, "utf8"));
}

async function main() {
  const date = process.env.XLB_SNAPSHOT_DATE?.trim();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date ?? ""), "XLB_SNAPSHOT_DATE must use YYYY-MM-DD");
  const directory = new URL("../snapshots/", import.meta.url);
  const [ga4, searchConsole, merged] = await Promise.all([
    readJson(new URL(`ga4-${date}.json`, directory)),
    readJson(new URL(`search-console-${date}.json`, directory)),
    readJson(new URL(`merged-${date}.json`, directory)),
  ]);

  validateAnalyticsSnapshotSet({ ga4, searchConsole, merged });
  console.log(`Validated analytics snapshot set for ${date}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
