import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const HEALTH_FILE = new URL("../../automation/reports/live-source-health.json", import.meta.url);
const RISK_FILE = new URL("../../automation/reports/live-risk-report.json", import.meta.url);
const AUTONOMY_STATE_FILE = new URL("../../automation/reports/autonomy-state.json", import.meta.url);
const OUTPUT_FILE = new URL("../../automation/reports/deploy-readiness.json", import.meta.url);

async function main() {
  const health = await readJsonIfExists(HEALTH_FILE);
  const risk = await readJsonIfExists(RISK_FILE);
  const autonomyState = await readJsonIfExists(AUTONOMY_STATE_FILE);

  const reasons = [];
  let status = "ready";

  if (health?.status !== "healthy") {
    status = "blocked";
    reasons.push("source health is not healthy");
  }

  if (!risk?.level) {
    status = "blocked";
    reasons.push("live risk report missing");
  } else if (risk.level === "high") {
    status = "blocked";
    reasons.push("live risk is high");
  } else if (risk.level === "medium") {
    status = "review-required";
    reasons.push("live risk requires review before deployment");
  }

  if (!autonomyState?.status) {
    status = "blocked";
    reasons.push("autonomy state missing");
  } else if (!autonomyState.isAutoDeployEligible) {
    status = status === "blocked" ? "blocked" : "review-required";
    reasons.push(`autonomy maturity is ${autonomyState.status}`);
  }

  const report = {
    checkedAt: new Date().toISOString(),
    status,
    canAutoDeploy: status === "ready",
    healthStatus: health?.status ?? "unknown",
    riskLevel: risk?.level ?? "unknown",
    autonomyStatus: autonomyState?.status ?? "unknown",
    reasons,
  };

  await writeJsonIfChanged(OUTPUT_FILE, report);
  console.log(`Updated automation/reports/deploy-readiness.json (${report.status})`);

  const failOnBlocked = process.env.XLB_FAIL_ON_BLOCKED_DEPLOY === "1";
  const failOnReview = process.env.XLB_FAIL_ON_REVIEW_DEPLOY === "1";

  if (failOnBlocked && report.status === "blocked") {
    throw new Error(`Deployment blocked: ${report.reasons.join("; ")}`);
  }

  if (failOnReview && report.status === "review-required") {
    throw new Error(`Deployment requires review: ${report.reasons.join("; ")}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
