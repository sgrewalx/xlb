import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import { parseCsv } from "./shared/csv.mjs";

const INPUT_FILE = process.env.XLB_SEARCH_CONSOLE_SOURCE
  ? new URL(process.env.XLB_SEARCH_CONSOLE_SOURCE, `file://${process.cwd()}/`)
  : new URL("./fixtures/search-console-sample.json", import.meta.url);

async function main() {
  const payload = applySnapshotDateOverride(await loadInput());
  const snapshot = normalizeSearchConsoleSnapshot(payload);
  const querySnapshot = normalizeSearchConsoleQuerySnapshot(payload, snapshot);
  const date = snapshot.capturedAt.slice(0, 10);
  const outputFile = new URL(
    `../snapshots/search-console-${date}.json`,
    import.meta.url,
  );
  const queryOutputFile = new URL(`../snapshots/search-console-queries-${date}.json`, import.meta.url);
  const [changed, queryChanged] = await Promise.all([
    writeJsonIfChanged(outputFile, snapshot),
    writeJsonIfChanged(queryOutputFile, querySnapshot),
  ]);

  console.log(
    changed
      ? `Updated automation/snapshots/search-console-${snapshot.capturedAt.slice(0, 10)}.json`
      : `automation/snapshots/search-console-${snapshot.capturedAt.slice(0, 10)}.json already matched normalized output`,
  );
  console.log(
    queryChanged
      ? `Updated automation/snapshots/search-console-queries-${date}.json`
      : `automation/snapshots/search-console-queries-${date}.json already matched normalized output`,
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
        clicks: toNumber(row.clicks),
        impressions: toNumber(row.impressions),
        ctr: toNumber(row.ctr),
        position: toNumber(row.position),
      })),
    };
  }

  return JSON.parse(contents);
}

export function normalizeSearchConsoleSnapshot(payload) {
  const capturedAt = toIso(payload.capturedAt ?? new Date().toISOString());
  const start = toIso(payload.window?.start ?? capturedAt);
  const end = toIso(payload.window?.end ?? capturedAt);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  return {
    capturedAt,
    window: { start, end },
    sources: {
      cloudflare: false,
      searchConsole: true,
      ga4: false,
      adsense: false,
    },
    pages: rows.map((row) => ({
      path: String(row.path ?? ""),
      pageviews: 0,
      visits: 0,
      searchImpressions: toNumber(row.impressions),
      searchCtr: toNumber(row.ctr),
      avgPosition: toNumber(row.position),
      watchClicks: 0,
      revenueUsd: 0,
      engagementScore: 0,
      decision: "review",
      notes: "Imported from Search Console-style export.",
    })),
  };
}

export function normalizeSearchConsoleQuerySnapshot(payload, pageSnapshot) {
  const rows = Array.isArray(payload.queryRows)
    ? payload.queryRows
    : Array.isArray(payload.rows)
      ? payload.rows.filter((row) => typeof row.query === "string")
      : [];
  return {
    capturedAt: pageSnapshot.capturedAt,
    window: pageSnapshot.window,
    sources: pageSnapshot.sources,
    dimensions: ["query", "page"],
    rows: rows.map((row) => ({
      query: String(row.query ?? "").trim(),
      path: normalizePath(row.path),
      clicks: toNumber(row.clicks),
      impressions: toNumber(row.impressions),
      ctr: toNumber(row.ctr),
      position: toNumber(row.position),
    })).filter((row) => row.query && row.path),
  };
}

function applySnapshotDateOverride(payload) {
  const snapshotDate = process.env.XLB_SNAPSHOT_DATE;

  if (!snapshotDate) {
    return payload;
  }

  const end = new Date(`${snapshotDate}T00:00:00.000Z`);
  if (Number.isNaN(end.valueOf())) {
    throw new Error(`Invalid XLB_SNAPSHOT_DATE: ${snapshotDate}`);
  }

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 1);

  return {
    ...payload,
    capturedAt: new Date(`${snapshotDate}T06:00:00.000Z`).toISOString(),
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}

function toNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizePath(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  try {
    return new URL(text).pathname || "/";
  } catch {
    return text.startsWith("/") ? text : `/${text}`;
  }
}

function toIso(value) {
  const date = new Date(String(value));

  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return date.toISOString();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
