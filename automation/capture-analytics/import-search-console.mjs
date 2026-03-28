import { readFile } from "node:fs/promises";
import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import { parseCsv } from "./shared/csv.mjs";

const INPUT_FILE = process.env.XLB_SEARCH_CONSOLE_SOURCE
  ? new URL(process.env.XLB_SEARCH_CONSOLE_SOURCE, `file://${process.cwd()}/`)
  : new URL("./fixtures/search-console-sample.json", import.meta.url);

async function main() {
  const payload = await loadInput();
  const snapshot = normalizeSearchConsoleSnapshot(payload);
  const outputFile = new URL(
    `../snapshots/search-console-${snapshot.capturedAt.slice(0, 10)}.json`,
    import.meta.url,
  );
  const changed = await writeJsonIfChanged(outputFile, snapshot);

  console.log(
    changed
      ? `Updated automation/snapshots/search-console-${snapshot.capturedAt.slice(0, 10)}.json`
      : `automation/snapshots/search-console-${snapshot.capturedAt.slice(0, 10)}.json already matched normalized output`,
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

function normalizeSearchConsoleSnapshot(payload) {
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
