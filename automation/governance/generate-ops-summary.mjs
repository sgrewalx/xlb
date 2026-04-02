import { appendFile, readdir, readFile } from "node:fs/promises";

const HEALTH_FILE = new URL("../../automation/reports/live-source-health.json", import.meta.url);
const RISK_FILE = new URL("../../automation/reports/live-risk-report.json", import.meta.url);
const DEPLOY_FILE = new URL("../../automation/reports/deploy-readiness.json", import.meta.url);
const AUTONOMY_FILE = new URL("../../automation/reports/autonomy-state.json", import.meta.url);
const SCOREBOARD_FILE = new URL("../../public/content/live/scoreboard.json", import.meta.url);
const AUDIT_FILE = new URL("../../automation/reports/content-audit.json", import.meta.url);
const AUTOFIX_FILE = new URL("../../automation/reports/low-risk-autofix.json", import.meta.url);
const IMPROVEMENT_QUEUE_FILE = new URL("../../automation/experiments/improvement-queue.json", import.meta.url);

async function readJson(url) {
  const raw = await readFile(url, "utf8");
  return JSON.parse(raw);
}

function titleCase(value) {
  return String(value ?? "unknown")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function main() {
  const [health, risk, deploy, autonomy, scoreboard, snapshot, audit, autofix, improvementQueue] = await Promise.all([
    readJson(HEALTH_FILE),
    readJson(RISK_FILE),
    readJson(DEPLOY_FILE),
    readJson(AUTONOMY_FILE),
    readJson(SCOREBOARD_FILE),
    readLatestMergedSnapshot(),
    readOptionalJson(AUDIT_FILE),
    readOptionalJson(AUTOFIX_FILE),
    readOptionalJson(IMPROVEMENT_QUEUE_FILE),
  ]);

  const topItems = Array.isArray(scoreboard.items) ? scoreboard.items.slice(0, 5) : [];
  const expandItems = Array.isArray(scoreboard.items)
    ? scoreboard.items.filter((item) => item.recommendation === "expand").slice(0, 3)
    : [];
  const sources = Array.isArray(health.sources) ? health.sources : [];
  const reasons = Array.isArray(risk.reasons) ? risk.reasons : [];
  const topPages = Array.isArray(snapshot?.pages)
    ? [...snapshot.pages]
        .sort((left, right) => (right.pageviews ?? 0) - (left.pageviews ?? 0))
        .slice(0, 5)
    : [];
  const nextActions = buildNextActions({ health, risk, topItems, expandItems });
  const queuedImprovements = Array.isArray(improvementQueue?.items)
    ? improvementQueue.items.filter((item) => item.status === "queued").slice(0, 5)
    : [];

  const markdown = [
    "## XLB Ops Summary",
    "",
    `- Deploy: **${titleCase(deploy.status)}**`,
    `- Risk: **${titleCase(risk.level)}**`,
    `- Autonomy: **${titleCase(autonomy.status)}**`,
    `- Source health: **${titleCase(health.status)}**`,
    `- Source stability: **${titleCase(health.stability?.status)}**`,
    `- Analytics coverage: **${Math.round(Number(risk.analyticsSignals?.eventCoverageRatio ?? 0) * 100)}%**`,
    `- Analytics sources: **GA4 ${risk.analyticsSignals?.ga4Enabled ? "on" : "off"} / Search Console ${risk.analyticsSignals?.searchConsoleEnabled ? "on" : "off"}**`,
    `- Audit findings: **${audit?.summary?.findingCount ?? 0}**`,
    `- Low-risk autofixes applied: **${autofix?.appliedCount ?? 0}**`,
    "",
    "### Current Blockers",
    ...reasons.map((reason) => `- ${reason}`),
    "",
    "### What The Engine Is Doing",
    ...expandItems.map(
      (item) =>
        `- expanding ${item.slug} because it is currently the strongest ${item.category} candidate (${item.pageviews ?? 0} pageviews)`,
    ),
    ...(!expandItems.length ? ["- no expansion candidates are currently strong enough to highlight"] : []),
    "",
    "### Source Status",
    ...sources.map(
      (source) =>
        `- ${titleCase(source.id)}: ${titleCase(source.status)} | stable: ${source.stable ? "yes" : "no"} | healthy streak: ${source.healthyStreak ?? 0}`,
    ),
    "",
    "### Top Event Decisions",
    ...topItems.map(
      (item) =>
        `- ${item.slug}: ${titleCase(item.recommendation)} | score ${item.score ?? 0} | pageviews ${item.pageviews ?? 0}`,
    ),
    "",
    "### Top Pages In Latest Snapshot",
    ...topPages.map(
      (page) =>
        `- ${page.path}: ${page.pageviews ?? 0} pageviews | ${page.watchClicks ?? 0} watch clicks | engagement ${page.engagementScore ?? 0}`,
    ),
    ...(!topPages.length ? ["- no merged snapshot pages were available for this run"] : []),
    "",
    "### Recommended Next Actions",
    ...nextActions.map((action) => `- ${action}`),
    "",
    "### Improvement Queue",
    ...queuedImprovements.map(
      (item) => `- ${item.title} | risk ${item.risk} | targets ${item.targetPaths.join(", ")}`,
    ),
    ...(!queuedImprovements.length ? ["- no queued medium/high follow-ups remain after low-risk autofixes"] : []),
    "",
  ].join("\n");

  console.log(markdown);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
}

async function readLatestMergedSnapshot() {
  const snapshotDirectory = new URL("../../automation/snapshots/", import.meta.url);
  const filenames = await readdir(snapshotDirectory);
  const latestMerged = filenames
    .filter((filename) => filename.startsWith("merged-") && filename.endsWith(".json"))
    .sort()
    .at(-1);

  if (!latestMerged) {
    return null;
  }

  return readJson(new URL(`../../automation/snapshots/${latestMerged}`, import.meta.url));
}

async function readOptionalJson(url) {
  try {
    return await readJson(url);
  } catch {
    return null;
  }
}

function buildNextActions({ health, risk, topItems, expandItems }) {
  const actions = [];

  if (!health?.stability?.allSourcesStable) {
    actions.push("let another healthy NOAA run land before expecting unattended autonomy");
  }

  if (!risk?.analyticsSignals?.hasRealAnalyticsCoverage) {
    actions.push("keep collecting real GA4 and Search Console signals; indexing and impressions are still in the early stage");
  }

  if (expandItems.some((item) => item.slug === "nasa-live-programming")) {
    actions.push("keep improving NASA live pages first; they are still the strongest current watch destination");
  }

  if (expandItems.some((item) => item.slug === "global-earthquake-watch")) {
    actions.push("keep improving earthquake monitoring pages; they are the strongest repeat-check earth pages");
  }

  if (topItems.some((item) => item.recommendation === "review" && (item.pageviews ?? 0) === 0)) {
    actions.push("leave low-signal launch pages in review until they either gain impressions or get stronger supporting context");
  }

  return actions.length ? actions : ["no urgent operator action is required from this run"];
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
