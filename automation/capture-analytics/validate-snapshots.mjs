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
  validateAnalyticsSnapshot(searchConsole, {
    label: "Search Console",
    expectedSource: "searchConsole",
  });
  validateAnalyticsSnapshot(merged, { label: "Merged", expectedSource: "ga4" });
  assert(merged.sources.searchConsole === true, "Merged: searchConsole source must be enabled");
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
