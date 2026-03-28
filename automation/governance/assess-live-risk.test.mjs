import test from "node:test";
import assert from "node:assert/strict";
import {
  countConsecutive,
  evaluateAutonomyCandidate,
  isHeuristicOverrideEligible,
  rollForwardAutonomyState,
  summarizeAnalyticsSignals,
} from "./assess-live-risk.mjs";

test("summarizeAnalyticsSignals detects real analytics coverage when enough event pages are covered", () => {
  const snapshot = {
    sources: {
      ga4: true,
      searchConsole: true,
    },
    pages: [
      { path: "/events/a", pageviews: 12, searchImpressions: 40 },
      { path: "/events/b", pageviews: 8, searchImpressions: 15 },
      { path: "/events/c", pageviews: 0, searchImpressions: 0 },
      { path: "/topics/nasa", pageviews: 25, searchImpressions: 50 },
    ],
  };
  const scoreboardItems = [
    { pagePath: "/events/a", pageviews: 12, searchImpressions: 40 },
    { pagePath: "/events/b", pageviews: 8, searchImpressions: 15 },
    { pagePath: "/events/c", pageviews: 0, searchImpressions: 0 },
  ];

  const signals = summarizeAnalyticsSignals(snapshot, scoreboardItems, 0.6);

  assert.equal(signals.hasRealAnalyticsCoverage, true);
  assert.equal(signals.hasDecisionCoverage, true);
  assert.equal(signals.coldStartOverrideEligible, true);
  assert.equal(signals.eventCoverageRatio, 0.67);
});

test("isHeuristicOverrideEligible unlocks when all sources are stable and heuristic scores are strong", () => {
  const eligible = isHeuristicOverrideEligible(
    {
      stability: {
        allSourcesStable: true,
      },
    },
    [
      { heuristicScore: 72, sourceStability: "stable", recommendation: "hold" },
      { heuristicScore: 68, sourceStability: "stable", recommendation: "expand" },
      { heuristicScore: 70, sourceStability: "stable", recommendation: "expand" },
      { heuristicScore: 74, sourceStability: "stable", recommendation: "hold" },
      { heuristicScore: 69, sourceStability: "stable", recommendation: "hold" },
    ],
  );

  assert.equal(eligible, true);
});

test("evaluateAutonomyCandidate rejects cold-start and pruned scoreboards", () => {
  const result = evaluateAutonomyCandidate({
    health: { status: "healthy" },
    analyticsSignals: {
      hasDecisionCoverage: true,
      coldStartOverrideEligible: false,
      heuristicOverrideEligible: false,
    },
    scoreboardItems: [
      { slug: "nasa-live", category: "space", scoringMode: "cold-start", recommendation: "expand" },
      { slug: "weak-launch", category: "space", scoringMode: "cold-start", recommendation: "prune" },
    ],
  });

  assert.equal(result.eligibleNow, false);
  assert.equal(result.coldStartCount, 2);
  assert.deepEqual(result.prunedItems, ["weak-launch"]);
  assert.equal(result.launchClusterWinning, true);
});

test("rollForwardAutonomyState becomes auto-deploy-eligible after enough consecutive good runs", () => {
  const thresholds = {
    historyLimit: 14,
    minimumHealthyStreak: 3,
    minimumAnalyticsStreak: 3,
    minimumAutonomyStreak: 3,
  };
  const previousState = {
    recentRuns: [
      {
        assessedAt: "2026-03-27T00:00:00.000Z",
        sourceHealthy: true,
        hasRealAnalyticsCoverage: true,
        coldStartOverrideEligible: true,
        eligibleForAutoDeployNow: true,
      },
      {
        assessedAt: "2026-03-26T00:00:00.000Z",
        sourceHealthy: true,
        hasRealAnalyticsCoverage: true,
        coldStartOverrideEligible: true,
        eligibleForAutoDeployNow: true,
      },
    ],
  };

  const nextState = rollForwardAutonomyState({
    previousState,
    assessedAt: "2026-03-28T00:00:00.000Z",
    health: { status: "healthy" },
    analyticsSignals: {
      hasRealAnalyticsCoverage: true,
      coldStartOverrideEligible: true,
    },
    autonomyCandidate: {
      eligibleNow: true,
    },
    thresholds,
  });

  assert.equal(nextState.status, "auto-deploy-eligible");
  assert.equal(nextState.isAutoDeployEligible, true);
  assert.deepEqual(nextState.streaks, {
    healthySource: 3,
    analyticsCoverage: 3,
    autonomyEligible: 3,
  });
});

test("countConsecutive stops at the first broken run", () => {
  const runs = [
    { ok: true },
    { ok: true },
    { ok: false },
    { ok: true },
  ];

  assert.equal(countConsecutive(runs, (run) => run.ok), 2);
});
