import test from "node:test";
import assert from "node:assert/strict";
import { buildDeployReadiness } from "./check-deploy-readiness.mjs";
import { evaluateDeploymentPolicy } from "./enforce-deploy-readiness.mjs";

const healthy = { status: "healthy" };
const eligible = { status: "active-learning", isAutoDeployEligible: true };

test("blocked readiness has precedence over review-required inputs", () => {
  const report = buildDeployReadiness({
    health: { status: "degraded" },
    risk: { level: "medium" },
    autonomyState: { status: "earning-trust", isAutoDeployEligible: false },
    checkedAt: "2026-08-20T00:00:00.000Z",
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.canAutoDeploy, false);
});

test("review-required blocks every automatic production trigger", () => {
  for (const trigger of ["push", "workflow_run", "schedule"]) {
    assert.deepEqual(
      evaluateDeploymentPolicy({ status: "review-required", trigger, supervisedOverride: true }),
      {
        allowed: false,
        reason: "review-required deployment needs an explicit supervised manual override",
      },
    );
  }
});

test("review-required permits only an explicit supervised manual override", () => {
  assert.equal(
    evaluateDeploymentPolicy({
      status: "review-required",
      trigger: "workflow_dispatch",
      supervisedOverride: false,
    }).allowed,
    false,
  );
  assert.equal(
    evaluateDeploymentPolicy({
      status: "review-required",
      trigger: "workflow_dispatch",
      supervisedOverride: true,
    }).allowed,
    true,
  );
});

test("blocked readiness cannot be overridden and ready can deploy", () => {
  assert.equal(
    evaluateDeploymentPolicy({
      status: "blocked",
      trigger: "workflow_dispatch",
      supervisedOverride: true,
    }).allowed,
    false,
  );
  assert.equal(evaluateDeploymentPolicy({ status: "ready", trigger: "push" }).allowed, true);

  const report = buildDeployReadiness({
    health: healthy,
    risk: { level: "low" },
    autonomyState: eligible,
    checkedAt: "2026-08-20T00:00:00.000Z",
  });
  assert.equal(report.status, "ready");
});
