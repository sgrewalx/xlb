import { spawnSync } from "node:child_process";
import { assertPromotableCandidate } from "./validate-candidate-change-set.mjs";

export const candidateSteps = [
  { id: "traffic-opportunities", script: "automation:traffic-opportunities", analytics: true },
  { id: "live-events", script: "automation:live-events" },
  {
    id: "source-health",
    script: "automation:source-health",
    env: { XLB_FAIL_ON_DEGRADED_SOURCES: "1" },
  },
  { id: "rank-live", script: "automation:rank-live", analytics: true },
  { id: "low-risk-autofixes", script: "automation:apply-low-risk-fixes" },
  { id: "surface-manifests", script: "automation:traffic-engine", analytics: true },
  { id: "apply-opportunities", script: "automation:apply-opportunities" },
  { id: "sitemap", script: "generate:sitemap" },
  { id: "content-audit", script: "automation:content-audit" },
  {
    id: "live-risk",
    script: "automation:assess-live-risk",
    env: { XLB_FAIL_ON_HIGH_RISK: "1" },
  },
  { id: "deploy-readiness", script: "automation:check-deploy-readiness" },
  { id: "ops-summary", script: "automation:ops-summary" },
];

export async function runCandidatePipeline({
  steps = candidateSteps,
  runStep,
  validateAndBuild,
  assertPromotable = async () => {},
  promoteCandidate = async () => {},
  failStep,
}) {
  for (const step of steps) {
    if (failStep === step.id) {
      throw new Error(`Injected candidate failure at ${step.id}`);
    }
    await runStep(step);
  }

  await assertPromotable();
  await validateAndBuild();
  await promoteCandidate();
}

function runNpmStep(step, snapshotDate) {
  const env = { ...process.env, ...step.env };
  if (step.analytics) {
    env.XLB_ANALYTICS_SNAPSHOT = `./automation/snapshots/merged-${snapshotDate}.json`;
  }

  console.log(`Candidate step: ${step.id}`);
  const result = spawnSync("npm", ["run", step.script], {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Candidate step ${step.id} failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function main() {
  const snapshotDate = process.env.XLB_SNAPSHOT_DATE?.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate ?? "")) {
    throw new Error("XLB_SNAPSHOT_DATE must use YYYY-MM-DD");
  }

  await runCandidatePipeline({
    runStep: (step) => runNpmStep(step, snapshotDate),
    assertPromotable: assertPromotableCandidate,
    validateAndBuild: () => runNpmStep({ id: "validated-build", script: "release:build" }),
    failStep: process.env.XLB_FAIL_CANDIDATE_STEP,
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
