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
    measurement: { capturedAt: null, asOf: null, sourceWindow: null, metrics: { searchImpressions: null, pageviews: null }, daysElapsed: status === "measuring" ? 0 : null, evidenceSufficient: false },
    decision: { state: "pending", decidedAt: null, result: null, confidence: null, reason: null },
  };
}
function queue(item = experiment()) { return { schemaVersion: 2, updatedAt: "2026-09-01T00:00:00.000Z", items: [item] }; }
function snapshot(asOf, impressions) {
  const hasSearch = impressions !== null;
  return { capturedAt: asOf, window: { start: "2026-09-01T00:00:00.000Z", end: asOf }, pages: [{ path: "/events/test", pageviews: 5, searchImpressions: impressions ?? 0, searchCtr: hasSearch ? 0.1 : 0, notes: `Imported from the GA4 Data API.${hasSearch ? " Imported from the Search Console API." : ""}` }] };
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
  const day0 = measureExperiments(active, snapshot(RELEASE.deployedAt, 10));
  assert.equal(day0.items[0].measurement.daysElapsed, 0);
  assert.equal(day0.items[0].status, "measuring");
  const day7 = measureExperiments(active, snapshot("2026-09-08T12:00:00.000Z", 10));
  assert.equal(day7.items[0].measurement.daysElapsed, 7);
  assert.equal(day7.items[0].status, "measuring");
  const day14Low = measureExperiments(active, snapshot("2026-09-15T12:00:00.000Z", 9));
  assert.equal(day14Low.items[0].status, "measuring");
  const day14Enough = measureExperiments(active, snapshot("2026-09-15T12:00:00.000Z", 10));
  assert.equal(day14Enough.items[0].status, "evaluating");
  assert.equal(day14Enough.items[0].decision.result, null);
  assert.doesNotMatch(day14Enough.items[0].decision.reason, /significant/i);
});

test("missing route-source evidence remains null", () => {
  const measured = measureExperiments(queue(experiment("measuring")), snapshot("2026-09-15T12:00:00.000Z", null));
  assert.equal(measured.items[0].measurement.metrics.searchImpressions, null);
  assert.equal(measured.items[0].measurement.evidenceSufficient, false);
  assert.equal(measured.items[0].status, "measuring");
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
