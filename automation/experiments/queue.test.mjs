import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateExperimentQueue } from "./model.mjs";

const queue = JSON.parse(await readFile(new URL("./queue.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../contracts/experiment-queue.schema.json", import.meta.url), "utf8"));

test("experiment queue uses the V2 lifecycle contract without inventing missing evidence", () => {
  validateExperimentQueue(queue);
  const experiment = queue.items.find((item) => item.id === "earthquake-intelligence-v1");
  assert.equal(queue.schemaVersion, 2);
  assert.equal(experiment.status, "measuring");
  assert.equal(experiment.measurementStart.productionReleaseSha, "4556d15d327b810109e8fb807b93715e33464462");
  assert.equal(experiment.baseline.metrics.searchImpressions, null);
  assert.equal(experiment.measurement.metrics.earthquakeInteractions, null);
  assert.equal(experiment.measurement.metrics.pageviews, null);
  assert.equal(experiment.measurement.evidenceState, "not-yet-comparable");
  assert.equal(experiment.measurement.evidenceWindows.ga4.complete, false);
  assert.equal(experiment.measurement.evidenceWindows.searchConsole.complete, false);
  assert.match(experiment.notes, /workflow run 33756172282/);
});

test("schema exposes every lifecycle and bounded decision result", () => {
  assert.deepEqual(schema.properties.items.items.properties.status.enum, ["idea", "queued", "building", "awaiting-production-deployment", "measuring", "evaluating", "completed", "rejected", "paused"]);
  assert.deepEqual(schema.properties.items.items.properties.decision.properties.result.enum, ["win", "lose", "inconclusive", "guardrail-failure", null]);
});

test("invalid metrics and premature decisions fail closed", () => {
  const invalidMetric = structuredClone(queue);
  invalidMetric.items[0].measurement.metrics.searchImpressions = -1;
  assert.throws(() => validateExperimentQueue(invalidMetric), /non-negative number or null/);
  const invalidDecision = structuredClone(queue);
  invalidDecision.items[0].decision.result = "win";
  assert.throws(() => validateExperimentQueue(invalidDecision), /premature decision/);
});
