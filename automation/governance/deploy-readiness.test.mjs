import test from "node:test";
import assert from "node:assert/strict";
import { buildDeployReadiness } from "./check-deploy-readiness.mjs";
import {
  DEFAULT_MAX_READINESS_AGE_HOURS,
  evaluateDeploymentPolicy,
  parseMaxReadinessAgeHours,
} from "./enforce-deploy-readiness.mjs";
import { buildEvidenceBindings, hashGovernanceEvidence } from "./governance-evidence.mjs";

const NOW = Date.parse("2026-08-20T12:00:00.000Z");
const evidence = {
  health: { status: "healthy", sources: [{ id: "source-a", status: "healthy" }] },
  risk: { level: "low", reasons: [] },
  autonomyState: { status: "active-learning", isAutoDeployEligible: true },
};

function readinessReport({
  health = evidence.health,
  risk = evidence.risk,
  autonomyState = evidence.autonomyState,
  checkedAt = "2026-08-20T11:00:00.000Z",
} = {}) {
  return buildDeployReadiness({ health, risk, autonomyState, checkedAt });
}

function decide(report, overrides = {}) {
  return evaluateDeploymentPolicy({
    report,
    evidence,
    trigger: "push",
    releaseClassification: "content-only",
    now: NOW,
    ...overrides,
  });
}

test("readiness evidence hashes are deterministic across object key order", () => {
  assert.equal(
    hashGovernanceEvidence({ beta: 2, alpha: { delta: 4, gamma: 3 } }),
    hashGovernanceEvidence({ alpha: { gamma: 3, delta: 4 }, beta: 2 }),
  );
  assert.deepEqual(readinessReport().evidence, buildEvidenceBindings(evidence));
});

test("blocked readiness has precedence over review-required inputs", () => {
  const report = readinessReport({
    health: { status: "degraded" },
    risk: { level: "medium" },
    autonomyState: { status: "earning-trust", isAutoDeployEligible: false },
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.canAutoDeploy, false);
});

test("stale ready is denied", () => {
  const report = readinessReport({ checkedAt: "2026-08-18T23:59:59.000Z" });
  const decision = decide(report);

  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveStatus, "blocked");
  assert.match(decision.reason, /stale/);
});

test("stale review-required cannot use a supervised override", () => {
  const reviewEvidence = { ...evidence, risk: { level: "medium", reasons: ["review"] } };
  const report = readinessReport({
    risk: reviewEvidence.risk,
    checkedAt: "2026-08-18T23:59:59.000Z",
  });
  const decision = decide(report, {
    evidence: reviewEvidence,
    trigger: "workflow_dispatch",
    supervisedOverride: true,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveStatus, "blocked");
  assert.match(decision.reason, /stale/);
});

test("evidence hash mismatch is denied", () => {
  const report = readinessReport();
  const changedEvidence = {
    ...evidence,
    risk: { level: "medium", reasons: ["changed after readiness calculation"] },
  };
  const decision = decide(report, {
    evidence: changedEvidence,
    trigger: "workflow_dispatch",
    supervisedOverride: true,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveStatus, "blocked");
  assert.match(decision.reason, /hash does not match/);
});

test("stored readiness status must agree with the bound evidence", () => {
  const report = readinessReport({ risk: { level: "medium", reasons: ["review"] } });
  const reviewEvidence = { ...evidence, risk: { level: "medium", reasons: ["review"] } };
  report.status = "ready";
  report.canAutoDeploy = true;
  const decision = decide(report, { evidence: reviewEvidence });

  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveStatus, "blocked");
  assert.match(decision.reason, /does not match the bound governance evidence/);
});

test("fresh evidence-matched ready is allowed", () => {
  const decision = decide(readinessReport());

  assert.equal(decision.allowed, true);
  assert.equal(decision.effectiveStatus, "ready");
});

test("fresh evidence-matched ready is allowed for repository_dispatch", () => {
  const decision = decide(readinessReport(), { trigger: "repository_dispatch" });

  assert.equal(decision.allowed, true);
  assert.equal(decision.effectiveStatus, "ready");
});

test("fresh evidence-matched review-required content is allowed automatically", () => {
  const reviewEvidence = { ...evidence, risk: { level: "medium", reasons: ["review"] } };
  const report = readinessReport({ risk: reviewEvidence.risk });

  const decision = decide(report, {
    evidence: reviewEvidence,
    trigger: "repository_dispatch",
  });
  assert.equal(decision.allowed, true);
  assert.equal(decision.effectiveStatus, "review-required");
  assert.match(decision.reason, /content-only/);
});

test("review-required release needs explicit workflow_dispatch override", () => {
  const reviewEvidence = { ...evidence, risk: { level: "medium", reasons: ["review"] } };
  const report = readinessReport({ risk: reviewEvidence.risk });
  const releaseClassification = "review-required";

  assert.equal(decide(report, { evidence: reviewEvidence, releaseClassification }).allowed, false);
  assert.equal(decide(report, {
    evidence: reviewEvidence,
    trigger: "workflow_dispatch",
    supervisedOverride: false,
    releaseClassification,
  }).allowed, false);
  assert.equal(decide(report, {
    evidence: reviewEvidence,
    trigger: "workflow_dispatch",
    supervisedOverride: true,
    releaseClassification,
  }).allowed, true);
  assert.equal(decide(report, {
    evidence: reviewEvidence,
    trigger: "push",
    supervisedOverride: true,
    releaseClassification,
  }).allowed, false);
  const automaticDecision = decide(report, {
    evidence: reviewEvidence,
    trigger: "repository_dispatch",
    supervisedOverride: true,
    releaseClassification,
  });
  assert.equal(automaticDecision.allowed, false);
  assert.equal(automaticDecision.effectiveStatus, "review-required");
});

test("blocked readiness remains non-overridable", () => {
  const blockedEvidence = { ...evidence, risk: { level: "high", reasons: ["blocked"] } };
  const report = readinessReport({ risk: blockedEvidence.risk });
  const decision = decide(report, {
    evidence: blockedEvidence,
    trigger: "workflow_dispatch",
    supervisedOverride: true,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveStatus, "blocked");
});

test("blocked readiness remains non-overridable for content-only releases", () => {
  const blockedEvidence = { ...evidence, risk: { level: "high", reasons: ["blocked"] } };
  const report = readinessReport({ risk: blockedEvidence.risk });
  const decision = decide(report, {
    evidence: blockedEvidence,
    trigger: "repository_dispatch",
    releaseClassification: "content-only",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveStatus, "blocked");
});

test("ready governance does not auto-deploy a review-required release", () => {
  const decision = decide(readinessReport(), {
    trigger: "repository_dispatch",
    releaseClassification: "review-required",
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveStatus, "review-required");
});

test("no-op release does not deploy", () => {
  const decision = decide(readinessReport(), { releaseClassification: "no-op" });
  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveStatus, "no-op");
});

test("missing timestamps and evidence bindings fail closed", () => {
  const missingTimestamp = readinessReport();
  delete missingTimestamp.checkedAt;
  assert.equal(decide(missingTimestamp).effectiveStatus, "blocked");

  const missingHash = readinessReport();
  delete missingHash.evidence.liveRisk.sha256;
  const decision = decide(missingHash);
  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveStatus, "blocked");
});

test("readiness maximum age defaults to 36 hours and is configurable", () => {
  assert.equal(DEFAULT_MAX_READINESS_AGE_HOURS, 36);
  assert.equal(parseMaxReadinessAgeHours(undefined), 36);
  assert.equal(parseMaxReadinessAgeHours("30"), 30);

  const report = readinessReport({ checkedAt: "2026-08-19T05:00:00.000Z" });
  assert.equal(decide(report, { maxAgeHours: 30 }).allowed, false);
  assert.equal(decide(report, { maxAgeHours: 32 }).allowed, true);
});
