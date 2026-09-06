const STATUSES = new Set(["idea", "queued", "building", "awaiting-production-deployment", "measuring", "evaluating", "completed", "rejected", "paused"]);
const RESULTS = new Set(["win", "lose", "inconclusive", "guardrail-failure"]);
const SHA_PATTERN = /^[0-9a-f]{40}$/;

export function validateExperimentQueue(queue) {
  assert(queue?.schemaVersion === 2, "experiment queue schemaVersion must be 2");
  assertDate(queue.updatedAt, "experiment queue updatedAt");
  assert(Array.isArray(queue.items), "experiment queue items must be an array");
  const ids = new Set();
  for (const item of queue.items) {
    assertText(item.id, "experiment id");
    assert(!ids.has(item.id), `duplicate experiment id ${item.id}`);
    ids.add(item.id);
    for (const key of ["title", "ownerAgent", "hypothesis", "primaryMetric", "successMetric", "rollbackPlan"]) assertText(item[key], `${item.id}.${key}`);
    assert(["low", "medium", "high"].includes(item.risk), `${item.id}.risk is invalid`);
    assert(STATUSES.has(item.status), `${item.id}.status is invalid`);
    assertPaths(item.targetPaths, `${item.id}.targetPaths`);
    assertStringArray(item.secondaryMetrics, `${item.id}.secondaryMetrics`);
    assertStringArray(item.guardrails, `${item.id}.guardrails`, true);
    assert(typeof item.notes === "string", `${item.id}.notes must be a string`);
    validateImplementation(item);
    validateMeasurementStart(item);
    validateEvidence(item.baseline, `${item.id}.baseline`);
    validateEvidence(item.measurement, `${item.id}.measurement`, true);
    validateDecision(item);
  }
  return queue;
}

function validateImplementation(item) {
  const value = item.implementation;
  if (value === null) {
    return;
  }
  assert(value?.binding === "commit-ancestor-and-paths", `${item.id}.implementation binding is invalid`);
  assert(SHA_PATTERN.test(value.introducedBySha ?? ""), `${item.id}.implementation SHA is invalid`);
  assertStringArray(value.requiredPaths, `${item.id}.implementation.requiredPaths`, true);
}

function validateMeasurementStart(item) {
  const value = item.measurementStart;
  assert(value?.trigger === "actual-production-deployment", `${item.id}.measurementStart trigger is invalid`);
  assert(["awaiting-production-deployment", "measuring", "completed"].includes(value.state), `${item.id}.measurementStart state is invalid`);
  assert(Number.isInteger(value.minimumDays) && value.minimumDays >= 1, `${item.id}.minimumDays is invalid`);
  assertText(value.minimumEvidence?.metric, `${item.id}.minimumEvidence.metric`);
  assert(Number.isFinite(value.minimumEvidence?.minimum) && value.minimumEvidence.minimum >= 0, `${item.id}.minimumEvidence.minimum is invalid`);
  assert(value.productionReleaseSha === null || SHA_PATTERN.test(value.productionReleaseSha), `${item.id}.productionReleaseSha is invalid`);
  if (value.productionDeployedAt !== null) assertDate(value.productionDeployedAt, `${item.id}.productionDeployedAt`);
  assert(value.diagnostic === null || typeof value.diagnostic === "string", `${item.id}.diagnostic is invalid`);
  if (["measuring", "evaluating", "completed"].includes(item.status)) {
    assert(SHA_PATTERN.test(value.productionReleaseSha ?? ""), `${item.id} is active without a production SHA`);
    assertDate(value.productionDeployedAt, `${item.id} is active without a deployment timestamp`);
  }
}

function validateEvidence(value, label, measurement = false) {
  assert(value && typeof value === "object", `${label} must be an object`);
  if (value.capturedAt !== null) assertDate(value.capturedAt, `${label}.capturedAt`);
  if (value.asOf !== undefined && value.asOf !== null) assertDate(value.asOf, `${label}.asOf`);
  if (value.sourceWindow !== null) {
    assertDate(value.sourceWindow?.start, `${label}.sourceWindow.start`);
    assertDate(value.sourceWindow?.end, `${label}.sourceWindow.end`);
  }
  assert(value.metrics && typeof value.metrics === "object" && !Array.isArray(value.metrics), `${label}.metrics must be an object`);
  for (const [key, metric] of Object.entries(value.metrics)) {
    assertText(key, `${label} metric name`);
    assert(metric === null || (Number.isFinite(metric) && metric >= 0), `${label}.${key} must be a non-negative number or null`);
  }
  if (measurement) {
    assert(value.daysElapsed === null || (Number.isInteger(value.daysElapsed) && value.daysElapsed >= 0), `${label}.daysElapsed is invalid`);
    assert(typeof value.evidenceSufficient === "boolean", `${label}.evidenceSufficient must be boolean`);
  }
}

function validateDecision(item) {
  const value = item.decision;
  assert(["pending", "evaluating", "decided"].includes(value?.state), `${item.id}.decision.state is invalid`);
  if (value.decidedAt !== null) assertDate(value.decidedAt, `${item.id}.decision.decidedAt`);
  assert(value.result === null || RESULTS.has(value.result), `${item.id}.decision.result is invalid`);
  assert(value.confidence === null || ["low", "medium", "high"].includes(value.confidence), `${item.id}.decision.confidence is invalid`);
  assert(value.reason === null || typeof value.reason === "string", `${item.id}.decision.reason is invalid`);
  if (value.state !== "decided") assert(value.result === null && value.decidedAt === null, `${item.id} has a premature decision result`);
}

function assertPaths(value, label) {
  assertStringArray(value, label, true);
  for (const path of value) assert(path.startsWith("/"), `${label} values must start with /`);
}

function assertStringArray(value, label, required = false) {
  assert(Array.isArray(value) && (!required || value.length > 0), `${label} must be ${required ? "a non-empty" : "an"} array`);
  for (const item of value) assertText(item, `${label} value`);
}

function assertDate(value, label) { assert(typeof value === "string" && Number.isFinite(Date.parse(value)), `${label} must be a date-time`); }
function assertText(value, label) { assert(typeof value === "string" && value.trim(), `${label} must be a non-empty string`); }
function assert(condition, message) { if (!condition) throw new Error(message); }
