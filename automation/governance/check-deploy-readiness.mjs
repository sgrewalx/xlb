import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";
import { buildEvidenceBindings } from "./governance-evidence.mjs";

const HEALTH_FILE = new URL("../../automation/reports/live-source-health.json", import.meta.url);
const RISK_FILE = new URL("../../automation/reports/live-risk-report.json", import.meta.url);
const AUTONOMY_STATE_FILE = new URL("../../automation/reports/autonomy-state.json", import.meta.url);
const OUTPUT_FILE = new URL("../../automation/reports/deploy-readiness.json", import.meta.url);

export function buildDeployReadiness({ health, risk, autonomyState, checkedAt = new Date().toISOString() }) {
  const reasons = [];
  let status = "ready";

  const requireReview = (reason) => {
    if (status !== "blocked") {
      status = "review-required";
    }
    reasons.push(reason);
  };

  const block = (reason) => {
    status = "blocked";
    reasons.push(reason);
  };

  if (health?.status !== "healthy") {
    block("source health is not healthy");
  }

  if (!risk?.level) {
    block("live risk report missing");
  } else if (risk.level === "high") {
    block("live risk is high");
  } else if (risk.level === "medium") {
    requireReview("live risk requires review before deployment");
  }

  if (!autonomyState?.status) {
    block("autonomy state missing");
  } else if (!autonomyState.isAutoDeployEligible) {
    requireReview(`autonomy maturity is ${autonomyState.status}`);
  }

  return {
    checkedAt,
    status,
    canAutoDeploy: status === "ready",
    healthStatus: health?.status ?? "unknown",
    riskLevel: risk?.level ?? "unknown",
    autonomyStatus: autonomyState?.status ?? "unknown",
    evidence: buildEvidenceBindings({ health, risk, autonomyState }),
    reasons,
  };
}

async function main() {
  const health = await readJsonIfExists(HEALTH_FILE);
  const risk = await readJsonIfExists(RISK_FILE);
  const autonomyState = await readJsonIfExists(AUTONOMY_STATE_FILE);
  const report = buildDeployReadiness({ health, risk, autonomyState });

  await writeJsonIfChanged(OUTPUT_FILE, report);
  console.log(`Updated automation/reports/deploy-readiness.json (${report.status})`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
