import { fileURLToPath } from "node:url";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const SCOREBOARD_FILE = new URL("../../public/content/live/scoreboard.json", import.meta.url);
const HEALTH_FILE = new URL("../../automation/reports/live-source-health.json", import.meta.url);
const SNAPSHOT_FILE = process.env.XLB_ANALYTICS_SNAPSHOT
  ? new URL(process.env.XLB_ANALYTICS_SNAPSHOT, `file://${process.cwd()}/`)
  : new URL("../../automation/snapshots/merged-2026-03-27.json", import.meta.url);
const OUTPUT_FILE = new URL("../../automation/reports/live-risk-report.json", import.meta.url);
const AUTONOMY_STATE_FILE = new URL("../../automation/reports/autonomy-state.json", import.meta.url);

export function getThresholds() {
  return {
    historyLimit: Number(process.env.XLB_AUTONOMY_HISTORY_LIMIT ?? 14),
    minimumCoverage: Number(process.env.XLB_MIN_ANALYTICS_COVERAGE ?? 0.6),
    minimumHealthyStreak: Number(process.env.XLB_MIN_HEALTHY_STREAK ?? 3),
    minimumAnalyticsStreak: Number(process.env.XLB_MIN_ANALYTICS_STREAK ?? 3),
    minimumAutonomyStreak: Number(process.env.XLB_MIN_AUTONOMY_STREAK ?? 3),
  };
}

async function main() {
  const thresholds = getThresholds();
  const scoreboard = await readJsonIfExists(SCOREBOARD_FILE);
  const health = await readJsonIfExists(HEALTH_FILE);
  const snapshot = await readJsonIfExists(SNAPSHOT_FILE);
  const previousAutonomyState = await readJsonIfExists(AUTONOMY_STATE_FILE);

  if (!scoreboard?.items?.length) {
    throw new Error("Live scoreboard is missing or empty");
  }

  const reasons = [];
  let level = "low";
  const analyticsSignals = summarizeAnalyticsSignals(
    snapshot,
    scoreboard.items,
    thresholds.minimumCoverage,
  );
  analyticsSignals.heuristicOverrideEligible = isHeuristicOverrideEligible(health, scoreboard.items);
  analyticsSignals.hasDecisionCoverage =
    analyticsSignals.hasRealAnalyticsCoverage || analyticsSignals.heuristicOverrideEligible;
  const autonomyCandidate = evaluateAutonomyCandidate({
    health,
    scoreboardItems: scoreboard.items,
    analyticsSignals,
  });
  const assessedAt = new Date().toISOString();
  const autonomyState = rollForwardAutonomyState({
    previousState: previousAutonomyState,
    assessedAt,
    health,
    analyticsSignals,
    autonomyCandidate,
    thresholds,
  });

  if (health?.status !== "healthy") {
    level = "high";
    reasons.push("source health degraded");
  }

  if (!health?.stability?.allSourcesStable) {
    level = escalate(level, "medium");
    reasons.push("source stability streak not reached yet");
  }

  if (!analyticsSignals.hasDecisionCoverage) {
    level = escalate(level, "medium");
    reasons.push("analytics coverage is still too thin for auto-deploy");
  }

  if (
    autonomyCandidate.coldStartCount > 0 &&
    !analyticsSignals.coldStartOverrideEligible &&
    !analyticsSignals.heuristicOverrideEligible
  ) {
    level = escalate(level, "medium");
    reasons.push("cold-start scoring still active");
  }

  if (autonomyCandidate.prunedItems.length > 0) {
    level = escalate(level, "medium");
    reasons.push(`pruned items present: ${autonomyCandidate.prunedItems.join(", ")}`);
  }

  if (!autonomyCandidate.launchClusterWinning) {
    level = escalate(level, "medium");
    reasons.push("launch cluster is not clearly winning yet");
  }

  if (level === "low" && !autonomyState.isAutoDeployEligible) {
    level = "medium";
    reasons.push(
      `autonomy maturity streak not reached yet (${autonomyState.streaks.autonomyEligible}/${autonomyState.thresholds.minimumAutonomyStreak})`,
    );
  }

  const report = {
    assessedAt,
    level,
    approval: level === "low" ? "auto-merge-eligible" : level === "medium" ? "pr-required" : "proposal-only",
    analyticsSignals,
    autonomyState: {
      status: autonomyState.status,
      isAutoDeployEligible: autonomyState.isAutoDeployEligible,
      streaks: autonomyState.streaks,
      thresholds: autonomyState.thresholds,
    },
    reasons,
  };

  await writeJsonIfChanged(AUTONOMY_STATE_FILE, autonomyState);
  await writeJsonIfChanged(OUTPUT_FILE, report);
  console.log(`Updated automation/reports/autonomy-state.json (${autonomyState.status})`);
  console.log(`Updated automation/reports/live-risk-report.json (${report.level})`);

  if (process.env.XLB_FAIL_ON_HIGH_RISK === "1" && report.level === "high") {
    throw new Error(`High risk live update: ${report.reasons.join("; ")}`);
  }
}

export function escalate(current, next) {
  const order = ["low", "medium", "high"];
  return order[Math.max(order.indexOf(current), order.indexOf(next))];
}

export function summarizeAnalyticsSignals(snapshot, scoreboardItems, minimumCoverage = 0.6) {
  if (!snapshot?.pages?.length) {
    return {
      hasSnapshot: false,
      hasRealAnalyticsCoverage: false,
      coldStartOverrideEligible: false,
      eventCoverageRatio: 0,
      ga4Enabled: false,
      searchConsoleEnabled: false,
    };
  }

  const eventPagePaths = scoreboardItems.map((item) => item.pagePath);
  const eventPages = snapshot.pages.filter((page) => eventPagePaths.includes(page.path));
  const coveredEventPages = eventPages.filter(
    (page) => (page.pageviews ?? 0) > 0 || (page.searchImpressions ?? 0) > 0,
  );
  const eventCoverageRatio =
    eventPagePaths.length > 0 ? coveredEventPages.length / eventPagePaths.length : 0;

  const ga4Enabled = Boolean(snapshot.sources?.ga4);
  const searchConsoleEnabled = Boolean(snapshot.sources?.searchConsole);
  const hasRealAnalyticsCoverage =
    ga4Enabled &&
    searchConsoleEnabled &&
    eventCoverageRatio >= minimumCoverage;

  const coldStartOverrideEligible =
    hasRealAnalyticsCoverage &&
    scoreboardItems.some((item) => item.pageviews > 0) &&
    scoreboardItems.some((item) => item.searchImpressions > 0);

  return {
    hasSnapshot: true,
    hasRealAnalyticsCoverage,
    hasDecisionCoverage: hasRealAnalyticsCoverage,
    coldStartOverrideEligible,
    heuristicOverrideEligible: false,
    eventCoverageRatio: Number(eventCoverageRatio.toFixed(2)),
    ga4Enabled,
    searchConsoleEnabled,
  };
}

export function isHeuristicOverrideEligible(health, scoreboardItems) {
  const averageHeuristicScore =
    scoreboardItems.length > 0
      ? scoreboardItems.reduce((total, item) => total + (item.heuristicScore ?? 0), 0) / scoreboardItems.length
      : 0;
  const nonDegradedItems = scoreboardItems.every((item) => item.sourceStability !== "degraded");
  const noPrunedItems = scoreboardItems.every((item) => item.recommendation !== "prune");

  return Boolean(
    health?.stability?.allSourcesStable &&
      scoreboardItems.length >= 5 &&
      averageHeuristicScore >= 65 &&
      nonDegradedItems &&
      noPrunedItems,
  );
}

export function evaluateAutonomyCandidate({ health, scoreboardItems, analyticsSignals }) {
  const coldStartCount = scoreboardItems.filter((item) => item.scoringMode === "cold-start").length;
  const prunedItems = scoreboardItems
    .filter((item) => item.recommendation === "prune")
    .map((item) => item.slug);
  const launchItems = scoreboardItems.filter((item) => item.category === "space");
  const launchClusterWinning =
    launchItems.length === 0 || launchItems.some((item) => item.recommendation === "expand");

  const eligibleNow =
    health?.status === "healthy" &&
    analyticsSignals.hasDecisionCoverage &&
    (coldStartCount === 0 || analyticsSignals.heuristicOverrideEligible) &&
    prunedItems.length === 0 &&
    launchClusterWinning;

  return {
    eligibleNow,
    coldStartCount,
    prunedItems,
    launchClusterWinning,
  };
}

export function rollForwardAutonomyState({
  previousState,
  assessedAt,
  health,
  analyticsSignals,
  autonomyCandidate,
  thresholds,
}) {
  const previousRuns = Array.isArray(previousState?.recentRuns) ? previousState.recentRuns : [];
  const currentRun = {
    assessedAt,
    sourceHealthy: health?.status === "healthy",
    hasRealAnalyticsCoverage: analyticsSignals.hasRealAnalyticsCoverage,
    coldStartOverrideEligible: analyticsSignals.coldStartOverrideEligible,
    eligibleForAutoDeployNow: autonomyCandidate.eligibleNow,
  };
  const recentRuns = [currentRun, ...previousRuns].slice(0, thresholds.historyLimit);
  const streaks = {
    healthySource: countConsecutive(recentRuns, (run) => run.sourceHealthy),
    analyticsCoverage: countConsecutive(recentRuns, (run) => run.hasRealAnalyticsCoverage),
    autonomyEligible: countConsecutive(recentRuns, (run) => run.eligibleForAutoDeployNow),
  };
  const isAutoDeployEligible =
    autonomyCandidate.eligibleNow &&
    streaks.healthySource >= thresholds.minimumHealthyStreak &&
    streaks.analyticsCoverage >= thresholds.minimumAnalyticsStreak &&
    streaks.autonomyEligible >= thresholds.minimumAutonomyStreak;

  return {
    assessedAt,
    status: isAutoDeployEligible
      ? "auto-deploy-eligible"
      : autonomyCandidate.eligibleNow
        ? "earning-trust"
        : "cold-start",
    isAutoDeployEligible,
    streaks,
    thresholds: {
      minimumHealthyStreak: thresholds.minimumHealthyStreak,
      minimumAnalyticsStreak: thresholds.minimumAnalyticsStreak,
      minimumAutonomyStreak: thresholds.minimumAutonomyStreak,
    },
    recentRuns,
  };
}

export function countConsecutive(runs, predicate) {
  let count = 0;

  for (const run of runs) {
    if (!predicate(run)) {
      break;
    }

    count += 1;
  }

  return count;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
