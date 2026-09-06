import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { appendHistoryRecord, buildHistoryRecord } from "./history.mjs";
import { bindProductionDeployment } from "./lifecycle.mjs";
import { measureExperiments } from "./measure.mjs";

const RELEASE = { releaseSha: "b".repeat(40), deployedAt: "2026-09-01T12:00:00.000Z" };

function experiment(status = "awaiting-production-deployment") {
  return {
    id: "exp", title: "Bound experiment", ownerAgent: "test", risk: "low", status,
    hypothesis: "A treatment improves evidence.", targetPaths: ["/events/test"], primaryMetric: "searchImpressions",
    secondaryMetrics: ["pageviews"], guardrails: ["No regression"], successMetric: "Ten impressions after fourteen days.", rollbackPlan: "Revert treatment.", notes: "Fixture.",
    implementation: { binding: "commit-ancestor-and-paths", introducedBySha: "a".repeat(40), requiredPaths: ["src/treatment.tsx"] },
    measurementStart: { trigger: "actual-production-deployment", state: status === "measuring" ? "measuring" : "awaiting-production-deployment", minimumDays: 14, minimumEvidence: { metric: "searchImpressions", minimum: 10 }, productionReleaseSha: status === "measuring" ? RELEASE.releaseSha : null, productionDeployedAt: status === "measuring" ? RELEASE.deployedAt : null, diagnostic: null },
    baseline: { capturedAt: null, sourceWindow: null, metrics: { searchImpressions: null, pageviews: null } },
    measurement: { capturedAt: null, asOf: null, sourceWindow: null, evidenceWindows: emptyWindows(), evidenceState: "not-yet-comparable", metrics: { searchImpressions: null, pageviews: null }, daysElapsed: status === "measuring" ? 0 : null, evidenceSufficient: false },
    decision: { state: "pending", decidedAt: null, result: null, confidence: null, reason: null },
  };
}
function queue(item = experiment()) { return { schemaVersion: 2, updatedAt: "2026-09-01T00:00:00.000Z", items: [item] }; }
function snapshot(asOf, impressions) {
  return { capturedAt: asOf, window: { start: "2026-09-02T00:00:00.000Z", end: asOf }, pages: [], impressions };
}
function emptyWindows() { return { ga4: { start: null, end: null, source: "ga4", complete: false, reason: "Awaiting evidence." }, searchConsole: { start: null, end: null, source: "search-console", complete: false, reason: "Awaiting evidence." } }; }
function sources(impressions, { start = "2026-09-02T00:00:00.000Z", end = "2026-09-15T00:00:00.000Z" } = {}) {
  return {
    ga4: { capturedAt: end, window: { start, end }, pages: [{ path: "/events/test", pageviews: 5, notes: "Imported from the GA4 Data API." }] },
    searchConsole: impressions === null ? null : { capturedAt: end, window: { start, end }, pages: [{ path: "/events/test", searchImpressions: impressions, searchCtr: 0.1, notes: "Imported from the Search Console API." }] },
  };
}
function measure(active, asOf, impressions, window) {
  return measureExperiments(active, snapshot(asOf, impressions), { asOf, evidenceSources: sources(impressions, window) });
}

test("matching exact deployment starts measurement and records SHA and timestamp", async () => {
  const result = await bindProductionDeployment(queue(), RELEASE, { containsCommit: async () => true, containsPath: async () => true });
  assert.equal(result.queue.items[0].status, "measuring");
  assert.equal(result.queue.items[0].measurement.daysElapsed, 0);
  assert.equal(result.queue.items[0].measurementStart.productionReleaseSha, RELEASE.releaseSha);
  assert.equal(result.queue.items[0].measurementStart.productionDeployedAt, RELEASE.deployedAt);
});

test("unrelated or ambiguous deployments remain pending", async () => {
  const unrelated = await bindProductionDeployment(queue(), RELEASE, { containsCommit: async () => false });
  assert.equal(unrelated.queue.items[0].status, "awaiting-production-deployment");
  const ambiguousItem = experiment(); ambiguousItem.implementation = null;
  const ambiguous = await bindProductionDeployment(queue(ambiguousItem), RELEASE);
  assert.equal(ambiguous.queue.items[0].status, "awaiting-production-deployment");
  assert.match(ambiguous.queue.items[0].measurementStart.diagnostic, /ambiguous/);
});

test("measurement honors Day 0, Day 7, minimumDays and evidence boundaries", () => {
  const active = queue(experiment("measuring"));
  const day0 = measure(active, RELEASE.deployedAt, 10);
  assert.equal(day0.items[0].measurement.daysElapsed, 0);
  assert.equal(day0.items[0].status, "measuring");
  const day7 = measure(active, "2026-09-08T12:00:00.000Z", 10);
  assert.equal(day7.items[0].measurement.daysElapsed, 7);
  assert.equal(day7.items[0].status, "measuring");
  const day14Low = measure(active, "2026-09-15T12:00:00.000Z", 9);
  assert.equal(day14Low.items[0].status, "measuring");
  const day14Enough = measure(active, "2026-09-15T12:00:00.000Z", 10);
  assert.equal(day14Enough.items[0].status, "evaluating");
  assert.equal(day14Enough.items[0].decision.result, null);
  assert.doesNotMatch(day14Enough.items[0].decision.reason, /significant/i);
});

test("missing route-source evidence remains null", () => {
  const measured = measure(queue(experiment("measuring")), "2026-09-15T12:00:00.000Z", null);
  assert.equal(measured.items[0].measurement.metrics.searchImpressions, null);
  assert.equal(measured.items[0].measurement.metrics.pageviews, 5);
  assert.equal(measured.items[0].measurement.evidenceSufficient, false);
  assert.equal(measured.items[0].status, "measuring");
});

test("rolling evidence that overlaps deployment cannot count", () => {
  const measured = measure(queue(experiment("measuring")), "2026-09-15T12:00:00.000Z", 20, { start: "2026-08-18T00:00:00.000Z", end: "2026-09-15T00:00:00.000Z" });
  assert.equal(measured.items[0].measurement.metrics.searchImpressions, null);
  assert.equal(measured.items[0].measurement.metrics.pageviews, null);
  assert.equal(measured.items[0].measurement.evidenceWindows.searchConsole.complete, false);
  assert.match(measured.items[0].measurement.evidenceWindows.searchConsole.reason, /overlaps pre-deployment/);
});

test("a complete post-deployment source period can supply evidence", () => {
  const measured = measure(queue(experiment("measuring")), "2026-09-15T12:00:00.000Z", 20);
  assert.equal(measured.items[0].measurement.metrics.searchImpressions, 20);
  assert.equal(measured.items[0].measurement.evidenceState, "sufficient");
  assert.equal(measured.items[0].status, "evaluating");
});

test("pre-deployment and missing source periods fail closed", () => {
  const before = measure(queue(experiment("measuring")), "2026-09-15T12:00:00.000Z", 20, { start: "2026-08-01T00:00:00.000Z", end: "2026-09-01T00:00:00.000Z" });
  assert.equal(before.items[0].measurement.evidenceState, "awaiting-source-lag");
  assert.equal(before.items[0].measurement.metrics.searchImpressions, null);
  const missing = measure(queue(experiment("measuring")), "2026-09-15T12:00:00.000Z", null);
  assert.equal(missing.items[0].measurement.evidenceState, "not-yet-comparable");
});

test("evaluating is sticky and terminal experiments are untouched", () => {
  const evaluating = experiment("measuring");
  evaluating.status = "evaluating";
  evaluating.decision = { state: "evaluating", decidedAt: null, result: null, confidence: null, reason: "Awaiting supervised review." };
  const sparse = measure(queue(evaluating), "2026-09-16T12:00:00.000Z", null);
  assert.equal(sparse.items[0].status, "evaluating");
  assert.deepEqual(sparse.items[0].decision, evaluating.decision);

  const enough = measure(queue(evaluating), "2026-09-16T12:00:00.000Z", 100);
  assert.equal(enough.items[0].status, "evaluating");
  assert.deepEqual(enough.items[0].decision, evaluating.decision);

  for (const status of ["completed", "paused", "rejected"]) {
    const terminal = structuredClone(evaluating);
    terminal.status = status;
    if (status === "completed") {
      terminal.measurementStart.state = "completed";
      terminal.decision = { state: "decided", decidedAt: "2026-09-15T00:00:00.000Z", result: "inconclusive", confidence: "low", reason: "Sparse evidence." };
    }
    assert.deepEqual(measure(queue(terminal), "2026-09-16T12:00:00.000Z", 100).items[0], terminal);
  }
});

test("completed history is append-only", async () => {
  const directory = await mkdtemp(join(tmpdir(), "xlb-history-"));
  try {
    const completed = experiment("measuring");
    completed.status = "completed";
    completed.measurementStart.state = "completed";
    completed.decision = { state: "decided", decidedAt: "2026-09-20T00:00:00.000Z", result: "inconclusive", confidence: "low", reason: "Sparse evidence." };
    const record = buildHistoryRecord(completed, { whatWasLearned: "Evidence remained sparse.", recommendedFollowUp: "Keep measuring discovery.", completedAt: completed.decision.decidedAt });
    const output = await appendHistoryRecord(directory, record);
    assert.equal(JSON.parse(await readFile(output, "utf8")).decision.result, "inconclusive");
    await assert.rejects(() => appendHistoryRecord(directory, record), /EEXIST/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
