import { readFile } from "node:fs/promises";
import path from "node:path";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const INPUT_FILE = process.env.XLB_ANALYTICS_SOURCE
  ? new URL(process.env.XLB_ANALYTICS_SOURCE, `file://${process.cwd()}/`)
  : new URL("./fixtures/cloudflare-sample.json", import.meta.url);

async function main() {
  const payload = await loadInput();
  const snapshot = normalizeSnapshot(payload);
  const snapshotPath = buildSnapshotPath(snapshot.capturedAt);
  const outputFile = new URL(`../snapshots/${snapshotPath}`, import.meta.url);

  const changed = await writeJsonIfChanged(outputFile, snapshot);

  console.log(
    changed
      ? `Updated automation/snapshots/${snapshotPath}`
      : `automation/snapshots/${snapshotPath} already matched normalized output`,
  );
}

async function loadInput() {
  const contents = await readFile(INPUT_FILE, "utf8");
  return JSON.parse(contents);
}

function normalizeSnapshot(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Analytics payload must be an object");
  }

  const capturedAt = toIso(payload.capturedAt ?? new Date().toISOString());
  const start = toIso(payload.window?.start ?? capturedAt);
  const end = toIso(payload.window?.end ?? capturedAt);
  const pages = Array.isArray(payload.pages) ? payload.pages : [];

  return {
    capturedAt,
    window: { start, end },
    sources: {
      cloudflare: Boolean(payload.sources?.cloudflare),
      searchConsole: Boolean(payload.sources?.searchConsole),
      ga4: Boolean(payload.sources?.ga4),
      adsense: Boolean(payload.sources?.adsense),
    },
    pages: pages.map((page) => ({
      path: String(page.path ?? ""),
      pageviews: toNumber(page.pageviews),
      visits: toNumber(page.visits),
      searchImpressions: toNumber(page.searchImpressions),
      searchCtr: toNumber(page.searchCtr),
      avgPosition: toNumber(page.avgPosition),
      watchClicks: toNumber(page.watchClicks),
      revenueUsd: toNumber(page.revenueUsd),
      engagementScore: toNumber(page.engagementScore),
      decision: page.decision ?? "review",
      notes: typeof page.notes === "string" ? page.notes : "",
    })),
  };
}

function buildSnapshotPath(capturedAt) {
  return `daily-${capturedAt.slice(0, 10)}.json`;
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toIso(value) {
  const date = new Date(String(value));

  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return date.toISOString();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
