import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import { validateExperimentQueue } from "./model.mjs";

const QUEUE_FILE = new URL("./queue.json", import.meta.url);
const SNAPSHOT_DIRECTORY = new URL("../snapshots/", import.meta.url);
const SEARCH_METRICS = new Set(["searchImpressions", "searchClicks", "searchCtr", "avgPosition"]);

export function measureExperiments(queue, snapshot, { asOf = snapshot.capturedAt } = {}) {
  validateExperimentQueue(queue);
  const measuredAt = new Date(asOf);
  if (!Number.isFinite(measuredAt.valueOf())) throw new Error("Experiment measurement asOf is invalid");
  let changed = false;
  const items = queue.items.map((item) => {
    if (!['measuring', 'evaluating'].includes(item.status)) return item;
    const deployedAt = Date.parse(item.measurementStart.productionDeployedAt);
    const daysElapsed = Math.max(0, Math.floor((measuredAt.valueOf() - deployedAt) / 86_400_000));
    const metricNames = [...new Set([item.primaryMetric, ...item.secondaryMetrics])];
    const metrics = Object.fromEntries(metricNames.map((metric) => [metric, aggregateMetric(snapshot, item.targetPaths, metric)]));
    const evidenceMetric = metrics[item.measurementStart.minimumEvidence.metric];
    const evidenceSufficient = typeof evidenceMetric === "number" && evidenceMetric >= item.measurementStart.minimumEvidence.minimum;
    const readyToEvaluate = daysElapsed >= item.measurementStart.minimumDays && evidenceSufficient;
    const status = readyToEvaluate ? "evaluating" : "measuring";
    changed = true;
    return {
      ...item,
      status,
      measurement: {
        capturedAt: snapshot.capturedAt,
        asOf: measuredAt.toISOString(),
        sourceWindow: structuredClone(snapshot.window),
        metrics,
        daysElapsed,
        evidenceSufficient,
      },
      decision: {
        ...item.decision,
        state: readyToEvaluate ? "evaluating" : "pending",
        reason: readyToEvaluate
          ? "Minimum duration and deterministic evidence threshold are met; supervised evaluation is required."
          : "Minimum duration and evidence have not both been met.",
      },
    };
  });
  const result = { ...queue, updatedAt: changed ? measuredAt.toISOString() : queue.updatedAt, items };
  validateExperimentQueue(result);
  return result;
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
  return readFile(new URL(filename, SNAPSHOT_DIRECTORY), "utf8").then(JSON.parse);
}

async function main() {
  const [queue, snapshot] = await Promise.all([readFile(QUEUE_FILE, "utf8").then(JSON.parse), latestSnapshot()]);
  const measured = measureExperiments(queue, snapshot, { asOf: process.env.XLB_MEASUREMENT_AS_OF || snapshot.capturedAt });
  await writeJsonIfChanged(QUEUE_FILE, measured);
  console.log(`Measured ${measured.items.filter((item) => ['measuring', 'evaluating'].includes(item.status)).length} active experiments`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
