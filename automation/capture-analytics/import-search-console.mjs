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
  if (payload.queryColumnPresent === false) {
    console.log("Search Console CSV has no Query column; query evidence is explicitly empty.");
  }
}

async function loadInput() {
  const contents = await readFile(INPUT_FILE, "utf8");

  if (INPUT_FILE.pathname.endsWith(".csv")) {
    return parseSearchConsoleCsv(contents);
  }

  return JSON.parse(contents);
}

export function parseSearchConsoleCsv(contents, defaults = {}) {
  const csvRows = parseCsv(contents);
  const first = csvRows[0] ?? {};
  const queryColumnPresent = Object.keys(first).some((header) => normalizeCsvHeader(header) === "query");
  const normalizedRows = csvRows.map((row) => ({
    query: csvValue(row, "query"),
    path: csvValue(row, "page", "path"),
    clicks: toNumber(csvValue(row, "clicks")),
    impressions: toNumber(csvValue(row, "impressions")),
    ctr: toNumber(csvValue(row, "ctr")),
    position: toNumber(csvValue(row, "position")),
  }));

  return {
    capturedAt: csvValue(first, "capturedat") || defaults.capturedAt,
    window: {
      start: csvValue(first, "windowstart") || defaults.window?.start,
      end: csvValue(first, "windowend") || defaults.window?.end,
    },
    rows: normalizedRows,
    queryRows: queryColumnPresent ? normalizedRows : [],
    queryColumnPresent,
  };
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
      path: normalizePath(row.path),
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
  const normalizedRows = rows.map((row) => ({
    query: String(row.query ?? "").trim(),
    path: normalizePath(row.path),
    clicks: toNumber(row.clicks),
    impressions: toNumber(row.impressions),
    ctr: toNumber(row.ctr),
    position: toNumber(row.position),
  })).filter((row) => row.query && row.path);
  return {
    capturedAt: pageSnapshot.capturedAt,
    window: pageSnapshot.window,
    sources: pageSnapshot.sources,
    dimensions: ["query", "page"],
    evidenceStatus: payload.queryColumnPresent === false
      ? "no-query-column"
      : normalizedRows.length
        ? "data"
        : "no-rows",
    rows: normalizedRows,
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
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }
  const text = String(value ?? "").trim();
  const percentage = text.endsWith("%");
  const number = Number(text.replaceAll(",", "").replace(/%$/, ""));
  if (!Number.isFinite(number) || number < 0) return 0;
  return percentage ? number / 100 : number;
}

function csvValue(row, ...names) {
  const accepted = new Set(names.map(normalizeCsvHeader));
  const entry = Object.entries(row).find(([header]) => accepted.has(normalizeCsvHeader(header)));
  return entry?.[1] ?? "";
}

function normalizeCsvHeader(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
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
