import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const DATE = process.env.XLB_SNAPSHOT_DATE ?? "2026-03-27";
const INPUTS = [
  new URL(`../snapshots/ga4-${DATE}.json`, import.meta.url),
  new URL(`../snapshots/search-console-${DATE}.json`, import.meta.url),
  new URL(`../snapshots/daily-${DATE}.json`, import.meta.url),
];
const OUTPUT_FILE = new URL(`../snapshots/merged-${DATE}.json`, import.meta.url);

async function main() {
  const snapshots = (
    await Promise.all(INPUTS.map((fileUrl) => readJsonIfExists(fileUrl)))
  ).filter(Boolean);

  if (!snapshots.length) {
    throw new Error(`No analytics snapshots found for ${DATE}`);
  }

  const merged = mergeSnapshots(snapshots);
  const changed = await writeJsonIfChanged(OUTPUT_FILE, merged);

  console.log(
    changed
      ? `Updated automation/snapshots/merged-${DATE}.json`
      : `automation/snapshots/merged-${DATE}.json already matched merged output`,
  );
}

function mergeSnapshots(snapshots) {
  const pageMap = new Map();

  snapshots.forEach((snapshot) => {
    snapshot.pages.forEach((page) => {
      const current = pageMap.get(page.path) ?? {
        path: page.path,
        pageviews: 0,
        visits: 0,
        searchImpressions: 0,
        searchCtr: 0,
        avgPosition: 0,
        watchClicks: 0,
        revenueUsd: 0,
        engagementScore: 0,
        decision: "review",
        notes: [],
      };

      current.pageviews = Math.max(current.pageviews, page.pageviews ?? 0);
      current.visits = Math.max(current.visits, page.visits ?? 0);
      current.searchImpressions = Math.max(current.searchImpressions, page.searchImpressions ?? 0);
      current.searchCtr = Math.max(current.searchCtr, page.searchCtr ?? 0);
      current.avgPosition = current.avgPosition === 0
        ? page.avgPosition ?? 0
        : weightedPosition(current.avgPosition, page.avgPosition ?? 0);
      current.watchClicks = Math.max(current.watchClicks, page.watchClicks ?? 0);
      current.revenueUsd = Math.max(current.revenueUsd, page.revenueUsd ?? 0);
      current.engagementScore = Math.max(current.engagementScore, page.engagementScore ?? 0);
      current.decision = page.decision ?? current.decision;

      if (page.notes) {
        current.notes.push(page.notes);
      }

      pageMap.set(page.path, current);
    });
  });

  return {
    capturedAt: snapshots.map((snapshot) => snapshot.capturedAt).sort().at(-1),
    window: snapshots[0].window,
    sources: snapshots.reduce(
      (accumulator, snapshot) => ({
        cloudflare: accumulator.cloudflare || Boolean(snapshot.sources?.cloudflare),
        searchConsole: accumulator.searchConsole || Boolean(snapshot.sources?.searchConsole),
        ga4: accumulator.ga4 || Boolean(snapshot.sources?.ga4),
        adsense: accumulator.adsense || Boolean(snapshot.sources?.adsense),
      }),
      { cloudflare: false, searchConsole: false, ga4: false, adsense: false },
    ),
    pages: [...pageMap.values()].map((page) => ({
      ...page,
      notes: page.notes.join(" | "),
    })),
  };
}

function weightedPosition(current, next) {
  if (!next) {
    return current;
  }

  return Number(((current + next) / 2).toFixed(2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
