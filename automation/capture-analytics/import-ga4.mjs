import { readFile } from "node:fs/promises";
import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import { parseCsv } from "./shared/csv.mjs";

const INPUT_FILE = process.env.XLB_GA4_SOURCE
  ? new URL(process.env.XLB_GA4_SOURCE, `file://${process.cwd()}/`)
  : new URL("./fixtures/ga4-sample.json", import.meta.url);

async function main() {
  const payload = await loadInput();
  const snapshot = normalizeGa4Snapshot(payload);
  const outputFile = new URL(`../snapshots/ga4-${snapshot.capturedAt.slice(0, 10)}.json`, import.meta.url);
  const changed = await writeJsonIfChanged(outputFile, snapshot);

  console.log(
    changed
      ? `Updated automation/snapshots/ga4-${snapshot.capturedAt.slice(0, 10)}.json`
      : `automation/snapshots/ga4-${snapshot.capturedAt.slice(0, 10)}.json already matched normalized output`,
  );
}

async function loadInput() {
  const contents = await readFile(INPUT_FILE, "utf8");

  if (INPUT_FILE.pathname.endsWith(".csv")) {
    const rows = parseCsv(contents);
    const first = rows[0] ?? {};

    return {
      capturedAt: first.capturedAt,
      window: {
        start: first.windowStart,
        end: first.windowEnd,
      },
      rows: rows.map((row) => ({
        path: row.path,
        screenPageViews: toNumber(row.screenPageViews),
        sessions: toNumber(row.sessions),
        eventCount: toNumber(row.eventCount),
        engagementRate: toNumber(row.engagementRate),
        averageSessionDuration: toNumber(row.averageSessionDuration),
      })),
    };
  }

  return JSON.parse(contents);
}

function normalizeGa4Snapshot(payload) {
  const capturedAt = toIso(payload.capturedAt ?? new Date().toISOString());
  const start = toIso(payload.window?.start ?? capturedAt);
  const end = toIso(payload.window?.end ?? capturedAt);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    capturedAt,
    window: { start, end },
    sources: {
      cloudflare: false,
      searchConsole: false,
      ga4: true,
      adsense: false,
    },
    pages: rows.map((row) => {
      const engagementRate = toNumber(row.engagementRate);
      const averageSessionDuration = toNumber(row.averageSessionDuration);

      return {
        path: String(row.path ?? ""),
        pageviews: toNumber(row.screenPageViews),
        visits: toNumber(row.sessions),
        searchImpressions: 0,
        searchCtr: 0,
        avgPosition: 0,
        watchClicks: toNumber(row.eventCount),
        revenueUsd: 0,
        engagementScore: computeEngagementScore(engagementRate, averageSessionDuration),
        decision: "review",
        notes: "Imported from GA4-style export.",
      };
    }),
  };
}

function computeEngagementScore(rate, durationSeconds) {
  const ratePoints = Math.round(rate * 70);
  const durationPoints = Math.min(Math.round(durationSeconds / 3), 30);
  return ratePoints + durationPoints;
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
