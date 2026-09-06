import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import { validateExperimentQueue } from "./model.mjs";

const QUEUE_FILE = new URL("./queue.json", import.meta.url);
const SNAPSHOT_DIRECTORY = new URL("../snapshots/", import.meta.url);
const SEARCH_METRICS = new Set(["searchImpressions", "searchClicks", "searchCtr", "avgPosition"]);
const SOURCE_NAMES = { ga4: "ga4", searchConsole: "search-console" };

export function measureExperiments(queue, snapshot, { asOf = snapshot.capturedAt, evidenceSources = {} } = {}) {
  validateExperimentQueue(queue);
  const measuredAt = new Date(asOf);
  if (!Number.isFinite(measuredAt.valueOf())) throw new Error("Experiment measurement asOf is invalid");
  let changed = false;
  const items = queue.items.map((item) => {
    if (!['measuring', 'evaluating'].includes(item.status)) return item;
    const deployedAt = Date.parse(item.measurementStart.productionDeployedAt);
    const daysElapsed = Math.max(0, Math.floor((measuredAt.valueOf() - deployedAt) / 86_400_000));
    const evidenceWindows = {
      ga4: assessEvidenceWindow(evidenceSources.ga4, item.measurementStart.productionDeployedAt, SOURCE_NAMES.ga4),
      searchConsole: assessEvidenceWindow(evidenceSources.searchConsole, item.measurementStart.productionDeployedAt, SOURCE_NAMES.searchConsole),
    };
    const metricNames = [...new Set([item.primaryMetric, ...item.secondaryMetrics])];
    const metrics = Object.fromEntries(metricNames.map((metric) => {
      const sourceKey = SEARCH_METRICS.has(metric) ? "searchConsole" : "ga4";
      return [metric, evidenceWindows[sourceKey].complete ? aggregateMetric(evidenceSources[sourceKey], item.targetPaths, metric) : null];
    }));
    const evidenceMetric = metrics[item.measurementStart.minimumEvidence.metric];
    const evidenceSufficient = typeof evidenceMetric === "number" && evidenceMetric >= item.measurementStart.minimumEvidence.minimum;
    const readyToEvaluate = daysElapsed >= item.measurementStart.minimumDays && evidenceSufficient;
    const evidenceSourceKey = SEARCH_METRICS.has(item.measurementStart.minimumEvidence.metric) ? "searchConsole" : "ga4";
    const evidenceState = classifyEvidence(evidenceWindows[evidenceSourceKey], evidenceSufficient);
    const alreadyEvaluating = item.status === "evaluating";
    const status = alreadyEvaluating || readyToEvaluate ? "evaluating" : "measuring";
    changed = true;
    return {
      ...item,
      status,
      measurement: {
        capturedAt: snapshot.capturedAt,
        asOf: measuredAt.toISOString(),
        sourceWindow: structuredClone(snapshot.window),
        evidenceWindows,
        evidenceState,
        metrics,
        daysElapsed,
        evidenceSufficient,
      },
      decision: alreadyEvaluating ? item.decision : {
        ...item.decision,
        state: readyToEvaluate ? "evaluating" : "pending",
        reason: readyToEvaluate
          ? "Minimum duration and deterministic post-deployment evidence threshold are met; supervised evaluation is required."
          : "Minimum duration and complete post-deployment evidence have not both been met.",
      },
    };
  });
  const result = { ...queue, updatedAt: changed ? measuredAt.toISOString() : queue.updatedAt, items };
  validateExperimentQueue(result);
  return result;
}

export function assessEvidenceWindow(snapshot, deployedAt, source) {
  const start = snapshot?.window?.start ?? null;
  const end = snapshot?.window?.end ?? null;
  const startTime = Date.parse(start ?? "");
  const endTime = Date.parse(end ?? "");
  const deployedTime = Date.parse(deployedAt ?? "");
  if (!snapshot || !Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) {
    return { start, end, source, complete: false, reason: "A valid source period is unavailable." };
  }
  if (endTime <= deployedTime) {
    return { start, end, source, complete: false, reason: "The source period ends before post-deployment measurement begins." };
  }
  if (startTime < deployedTime) {
    return { start, end, source, complete: false, reason: "The source period overlaps pre-deployment time." };
  }
  return { start, end, source, complete: true, reason: "The complete source period is post-deployment." };
}

function classifyEvidence(window, sufficient) {
  if (window.complete) return sufficient ? "sufficient" : "insufficient";
  if (window.reason.includes("ends before")) return "awaiting-source-lag";
  return "not-yet-comparable";
}

export function aggregateMetric(snapshot, targetPaths, metric) {
  const values = targetPaths.map((path) => metricForPage(snapshot.pages?.find((page) => page.path === path), metric));
  if (!values.length || values.some((value) => value === null)) return null;
  if (metric === "searchCtr" || metric === "avgPosition") return values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.reduce((sum, value) => sum + value, 0);
}

function metricForPage(page, metric) {
  if (!page) return null;
  const notes = String(page.notes ?? "");
  if (SEARCH_METRICS.has(metric) && !notes.includes("Search Console")) return null;
  if (!SEARCH_METRICS.has(metric) && !notes.includes("GA4")) return null;
  if (metric === "searchClicks") {
    return Number.isFinite(page.searchImpressions) && Number.isFinite(page.searchCtr)
      ? Number((page.searchImpressions * page.searchCtr).toFixed(6))
      : null;
  }
  return Number.isFinite(page[metric]) ? page[metric] : null;
}

async function latestSnapshot() {
  const filename = (await readdir(SNAPSHOT_DIRECTORY)).filter((name) => /^merged-\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().at(-1);
  if (!filename) throw new Error("No merged analytics snapshot is available");
  return { snapshot: await readFile(new URL(filename, SNAPSHOT_DIRECTORY), "utf8").then(JSON.parse), date: filename.slice(7, 17) };
}

async function sourceSnapshot(prefix, date) {
  try {
    return await readFile(new URL(`${prefix}-${date}.json`, SNAPSHOT_DIRECTORY), "utf8").then(JSON.parse);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function main() {
  const [{ snapshot, date }, queue] = await Promise.all([latestSnapshot(), readFile(QUEUE_FILE, "utf8").then(JSON.parse)]);
  const [ga4, searchConsole] = await Promise.all([sourceSnapshot("ga4", date), sourceSnapshot("search-console", date)]);
  const measured = measureExperiments(queue, snapshot, {
    asOf: process.env.XLB_MEASUREMENT_AS_OF || snapshot.capturedAt,
    evidenceSources: { ga4, searchConsole },
  });
  await writeJsonIfChanged(QUEUE_FILE, measured);
  console.log(`Measured ${measured.items.filter((item) => ['measuring', 'evaluating'].includes(item.status)).length} active experiments`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
