import { readdir, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { writeJsonIfChanged, writeTextIfChanged } from "../../shared/content-writer.mjs";
import { validateExperimentQueue } from "../../experiments/model.mjs";

const ROOT = new URL("../../../", import.meta.url);
const OUTPUT_DIRECTORY = new URL("./", import.meta.url);

export function buildWeeklyProgress({ snapshot, sourceSnapshots, queue, reports = {}, previous = null, releases = null, generatedAt = snapshot.capturedAt }) {
  validateExperimentQueue(queue);
  const ga4 = sourceSnapshots?.ga4;
  const searchConsole = sourceSnapshots?.searchConsole;
  const periods = {
    traffic: sourcePeriod(ga4, "ga4", generatedAt, previous?.periods?.traffic),
    search: sourcePeriod(searchConsole, "search-console", generatedAt, previous?.periods?.search),
  };
  const gaPages = ga4?.pages ?? [];
  const searchPages = searchConsole?.pages ?? [];
  const totals = ga4?.ga4?.dataStatus === "data" ? ga4.ga4.totals : null;
  const impressions = sum(searchPages.map((page) => page.searchImpressions));
  const clicks = searchPages.length ? sum(searchPages.map((page) => page.searchImpressions * page.searchCtr)) : null;
  const completed = queue.items.filter((item) => item.status === "completed");
  const releaseRecords = Array.isArray(releases) ? releases : null;
  const record = {
    schemaVersion: 1,
    generatedAt,
    week: isoWeek(generatedAt),
    periods,
    traffic: {
      users: numberOrNull(totals?.totalUsers),
      sessions: numberOrNull(totals?.sessions),
      pageviews: numberOrNull(totals?.screenPageViews),
      returnVisitors: gaPages.length ? sum(gaPages.map((page) => page.returnVisitors)) : null,
    },
    search: {
      impressions: searchPages.length ? impressions : null,
      clicks,
      ctr: impressions > 0 && clicks !== null ? clicks / impressions : searchPages.length ? 0 : null,
      visiblePages: searchPages.length ? searchPages.filter((page) => page.searchImpressions > 0).length : null,
    },
    product: {
      videoStarts: aggregateAvailable(gaPages, "videoStarts"),
      gameStarts: aggregateAvailable(gaPages, "gameStarts"),
      galleryOpens: aggregateAvailable(gaPages, "galleryOpens"),
      liveCardClicks: aggregateAvailable(gaPages, "liveCardClicks"),
      earthquakeInteractions: aggregateAvailable(gaPages, "earthquakeInteractions"),
    },
    experiments: {
      active: queue.items.filter((item) => ["building", "awaiting-production-deployment", "measuring", "evaluating"].includes(item.status)).length,
      startedThisWeek: queue.items.filter((item) => inPeriod(item.measurementStart.productionDeployedAt, periods.traffic.start, periods.traffic.end)).length,
      completedThisWeek: completed.filter((item) => inPeriod(item.decision.decidedAt, periods.traffic.start, periods.traffic.end)).length,
      wins: completed.filter((item) => item.decision.result === "win").length,
      losses: completed.filter((item) => item.decision.result === "lose" || item.decision.result === "guardrail-failure").length,
      inconclusive: completed.filter((item) => item.decision.result === "inconclusive").length,
    },
    releases: {
      deployments: releaseRecords ? releaseRecords.length : null,
      contentOnlyDeployments: releaseRecords ? releaseRecords.filter((item) => item.classification === "content-only").length : null,
      supervisedDeployments: releaseRecords ? releaseRecords.filter((item) => item.classification === "review-required").length : null,
    },
    automation: {
      sourceHealth: reports.sourceHealth?.status ?? "unavailable",
      deployReadiness: reports.deployReadiness?.status ?? "unavailable",
      contentAuditFindings: arrayLengthOrNull(reports.contentAudit?.findings),
      lowRiskFixesApplied: numberOrNull(reports.lowRiskFixes?.appliedCount),
    },
    topPages: combinedPages(gaPages, searchPages)
      .filter((page) => page.path)
      .sort((left, right) => pageScore(right) - pageScore(left))
      .slice(0, 8)
      .map((page) => ({
        path: page.path,
        pageviews: numberOrNull(page.pageviews),
        searchImpressions: numberOrNull(page.searchImpressions),
      })),
    notableChanges: buildNotableChanges(queue, reports),
    weekOverWeek: {},
  };
  record.weekOverWeek = buildDeltas(record, previous);
  return validateWeeklyProgress(record);
}

export function validateWeeklyProgress(record) {
  if (record?.schemaVersion !== 1) throw new Error("weekly progress schemaVersion must be 1");
  if (!/^\d{4}-W\d{2}$/.test(record.week ?? "")) throw new Error("weekly progress week is invalid");
  for (const [name, value] of [["generatedAt", record.generatedAt]]) {
    if (!Number.isFinite(Date.parse(value ?? ""))) throw new Error(`weekly progress ${name} is invalid`);
  }
  for (const name of ["traffic", "search"]) validatePeriod(record.periods?.[name], name);
  for (const section of ["traffic", "search", "product", "experiments", "releases"]) {
    if (!record[section] || typeof record[section] !== "object") throw new Error(`weekly progress ${section} is missing`);
    for (const [metric, value] of Object.entries(record[section])) {
      if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) throw new Error(`weekly progress ${section}.${metric} is invalid`);
    }
  }
  if (!Array.isArray(record.topPages) || !Array.isArray(record.notableChanges)) throw new Error("weekly progress lists are invalid");
  if (JSON.stringify(record).includes("search-console-queries")) throw new Error("weekly progress contains private query evidence");
  return record;
}

export function buildDeltas(current, previous) {
  const sections = ["traffic", "search", "product", "experiments", "releases"];
  return Object.fromEntries(sections.map((section) => [section, Object.fromEntries(
    Object.entries(current[section]).map(([metric, value]) => {
      const prior = previous?.[section]?.[metric];
      const sourcePeriod = section === "search" ? current.periods.search : current.periods.traffic;
      return [metric, sourcePeriod.comparableToPrevious && typeof value === "number" && typeof prior === "number" ? Number((value - prior).toFixed(6)) : null];
    }),
  )]));
}

export function renderWeeklyMarkdown(record) {
  const metric = (value, percent = false) => typeof value === "number" ? (percent ? `${(value * 100).toFixed(1)}%` : value.toLocaleString("en")) : "Unavailable";
  const lines = [
    `# XLB Weekly Progress - ${record.week}`,
    "",
    "## Executive Summary",
    `Traffic recorded ${metric(record.traffic.users)} users, ${metric(record.traffic.sessions)} sessions, and ${metric(record.traffic.pageviews)} pageviews. ${record.experiments.active} experiment(s) are active.`,
    "",
    "## Growth",
    `Source period: ${formatPeriod(record.periods.traffic)}`,
    `- Users: ${metric(record.traffic.users)}`,
    `- Sessions: ${metric(record.traffic.sessions)}`,
    `- Pageviews: ${metric(record.traffic.pageviews)}`,
    `- Return visitors: ${metric(record.traffic.returnVisitors)}`,
    "",
    "## Search Visibility",
    `Source period: ${formatPeriod(record.periods.search)}`,
    `- Impressions: ${metric(record.search.impressions)}`,
    `- Clicks: ${metric(record.search.clicks)}`,
    `- CTR: ${metric(record.search.ctr, true)}`,
    `- Visible pages: ${metric(record.search.visiblePages)}`,
    "",
    "## Product Engagement",
    `- Video starts: ${metric(record.product.videoStarts)}`,
    `- Game starts: ${metric(record.product.gameStarts)}`,
    `- Gallery opens: ${metric(record.product.galleryOpens)}`,
    `- Live-card clicks: ${metric(record.product.liveCardClicks)}`,
    `- Earthquake interactions: ${metric(record.product.earthquakeInteractions)}`,
    "",
    "## Experiments",
    `- Active: ${record.experiments.active}`,
    `- Started this week: ${record.experiments.startedThisWeek}`,
    `- Completed this week: ${record.experiments.completedThisWeek}`,
    "",
    "## Automation Health",
    `- Source health: ${record.automation.sourceHealth}`,
    `- Deploy readiness: ${record.automation.deployReadiness}`,
    `- Content audit findings: ${metric(record.automation.contentAuditFindings)}`,
    `- Low-risk fixes applied: ${metric(record.automation.lowRiskFixesApplied)}`,
    "",
    "## What Changed This Week",
    ...(record.notableChanges.length ? record.notableChanges.map((item) => `- ${item}`) : ["- No material control-plane change was recorded."]),
    "",
    "## What We Learned",
    "Evidence remains descriptive until an experiment reaches its duration and evidence thresholds and receives supervised evaluation.",
    "",
    "## Next Experiments / Decisions",
    "Review experiments that reach evaluating status; do not infer a win or loss from sparse evidence.",
    "",
  ];
  return lines.join("\n");
}

function validatePeriod(period, label) {
  if (!period || typeof period !== "object") throw new Error(`weekly progress ${label} period is missing`);
  for (const key of ["start", "end"]) if (!Number.isFinite(Date.parse(period[key] ?? ""))) throw new Error(`weekly progress ${label} period ${key} is invalid`);
  if (typeof period.source !== "string" || !period.source) throw new Error(`weekly progress ${label} period source is invalid`);
  if (!Number.isInteger(period.lagDays) || period.lagDays < 0) throw new Error(`weekly progress ${label} period lagDays is invalid`);
  if (typeof period.comparableToPrevious !== "boolean") throw new Error(`weekly progress ${label} period comparability is invalid`);
}

function sourcePeriod(snapshot, source, generatedAt, previous) {
  const start = snapshot?.window?.start;
  const end = snapshot?.window?.end;
  if (!Number.isFinite(Date.parse(start ?? "")) || !Number.isFinite(Date.parse(end ?? ""))) {
    throw new Error(`weekly progress ${source} source period is unavailable`);
  }
  return {
    start,
    end,
    source,
    lagDays: source === "search-console" ? sourceLagDays(generatedAt, end) : 0,
    comparableToPrevious: periodsAreComparable({ start, end }, previous),
  };
}

function periodsAreComparable(current, previous) {
  if (!previous) return false;
  const currentStart = Date.parse(current.start);
  const currentEnd = Date.parse(current.end);
  const previousStart = Date.parse(previous.start);
  const previousEnd = Date.parse(previous.end);
  const week = 7 * 86_400_000;
  return currentEnd - currentStart === week && previousEnd - previousStart === week && previousEnd === currentStart;
}

function sourceLagDays(generatedAt, end) {
  const generatedDay = Date.UTC(new Date(generatedAt).getUTCFullYear(), new Date(generatedAt).getUTCMonth(), new Date(generatedAt).getUTCDate());
  return Math.max(0, Math.round((generatedDay - Date.parse(end)) / 86_400_000) + 1);
}

function formatPeriod(period) {
  const lag = period.lagDays ? `; ${period.lagDays}-day source lag` : "";
  const comparison = period.comparableToPrevious ? "comparable with prior period" : "week-over-week comparison unavailable";
  return `${period.start} to ${period.end} (${period.source}${lag}; ${comparison})`;
}

function combinedPages(gaPages, searchPages) {
  const pages = new Map();
  for (const page of gaPages) pages.set(page.path, { path: page.path, pageviews: numberOrNull(page.pageviews), searchImpressions: null });
  for (const page of searchPages) {
    const current = pages.get(page.path) ?? { path: page.path, pageviews: null, searchImpressions: null };
    current.searchImpressions = numberOrNull(page.searchImpressions);
    pages.set(page.path, current);
  }
  return [...pages.values()];
}

function isoWeek(value) {
  const date = new Date(value);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target - yearStart) / 86_400_000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function aggregateAvailable(pages, key) {
  if (!pages.length || pages.some((page) => !Number.isFinite(page[key]))) return null;
  return sum(pages.map((page) => page[key]));
}
function numberOrNull(value) { return Number.isFinite(value) ? value : null; }
function sum(values) { return Number(values.reduce((total, value) => total + value, 0).toFixed(6)); }
function inPeriod(value, start, end) { const time = Date.parse(value ?? ""); return Number.isFinite(time) && time >= Date.parse(start) && time < Date.parse(end); }
function arrayLengthOrNull(value) { return Array.isArray(value) ? value.length : null; }
function pageScore(page) { return (page.pageviews ?? 0) * 3 + (page.searchImpressions ?? 0); }
function buildNotableChanges(queue, reports) {
  const changes = queue.items.filter((item) => ["measuring", "evaluating"].includes(item.status)).map((item) => `${item.title} is ${item.status} (Day ${item.measurement.daysElapsed ?? "unavailable"}).`);
  if (reports.deployReadiness?.status) changes.push(`Deploy readiness is ${reports.deployReadiness.status}.`);
  return changes;
}

async function latestFile(directory, pattern) {
  const name = (await readdir(directory)).filter((item) => pattern.test(item)).sort().at(-1);
  return name ? new URL(name, directory) : null;
}

async function readJson(url) { return url ? readFile(url, "utf8").then(JSON.parse) : null; }

async function main() {
  const snapshotUrl = await latestFile(new URL("automation/snapshots/", ROOT), /^merged-\d{4}-\d{2}-\d{2}\.json$/);
  if (!snapshotUrl) throw new Error("No merged analytics snapshot is available");
  const snapshotDate = snapshotUrl.pathname.match(/(\d{4}-\d{2}-\d{2})\.json$/)?.[1];
  const [snapshot, ga4, searchConsole, queue, sourceHealth, deployReadiness, contentAudit, lowRiskFixes] = await Promise.all([
    readJson(snapshotUrl),
    readJson(new URL(`automation/snapshots/ga4-${snapshotDate}.json`, ROOT)),
    readJson(new URL(`automation/snapshots/search-console-${snapshotDate}.json`, ROOT)),
    readJson(new URL("automation/experiments/queue.json", ROOT)),
    readJson(new URL("automation/reports/live-source-health.json", ROOT)), readJson(new URL("automation/reports/deploy-readiness.json", ROOT)),
    readJson(new URL("automation/reports/content-audit.json", ROOT)), readJson(new URL("automation/reports/low-risk-autofix.json", ROOT)),
  ]);
  const week = isoWeek(snapshot.capturedAt);
  const existing = (await readdir(OUTPUT_DIRECTORY)).filter((name) => /^\d{4}-W\d{2}\.json$/.test(name) && name < `${week}.json`).sort();
  const previous = existing.length ? await readJson(new URL(existing.at(-1), OUTPUT_DIRECTORY)) : null;
  const record = buildWeeklyProgress({ snapshot, sourceSnapshots: { ga4, searchConsole }, queue, previous, generatedAt: snapshot.capturedAt, reports: { sourceHealth, deployReadiness, contentAudit, lowRiskFixes } });
  await Promise.all([
    writeJsonIfChanged(new URL(`${record.week}.json`, OUTPUT_DIRECTORY), record),
    writeTextIfChanged(new URL(`${record.week}.md`, OUTPUT_DIRECTORY), renderWeeklyMarkdown(record)),
  ]);
  console.log(`Generated weekly progress ${record.week}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
