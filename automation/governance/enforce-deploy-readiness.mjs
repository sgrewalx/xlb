import { readJsonIfExists } from "../shared/content-writer.mjs";
import { buildDeployReadiness } from "./check-deploy-readiness.mjs";
import { verifyEvidenceBindings } from "./governance-evidence.mjs";

const READINESS_FILE = new URL("../../automation/reports/deploy-readiness.json", import.meta.url);
const HEALTH_FILE = new URL("../../automation/reports/live-source-health.json", import.meta.url);
const RISK_FILE = new URL("../../automation/reports/live-risk-report.json", import.meta.url);
const AUTONOMY_STATE_FILE = new URL("../../automation/reports/autonomy-state.json", import.meta.url);
export const DEFAULT_MAX_READINESS_AGE_HOURS = 36;

export function evaluateDeploymentPolicy({
  report,
  evidence,
  trigger,
  supervisedOverride = false,
  now = Date.now(),
  maxAgeHours = DEFAULT_MAX_READINESS_AGE_HOURS,
}) {
  if (!report || typeof report !== "object") {
    return { allowed: false, effectiveStatus: "blocked", reason: "readiness report is missing" };
  }

  const checkedAt = Date.parse(report.checkedAt);
  if (!Number.isFinite(checkedAt)) {
    return { allowed: false, effectiveStatus: "blocked", reason: "readiness checkedAt is missing or invalid" };
  }

  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    return { allowed: false, effectiveStatus: "blocked", reason: "readiness maximum age is invalid" };
  }

  const ageMs = now - checkedAt;
  if (ageMs < 0 || ageMs > maxAgeHours * 60 * 60 * 1000) {
    return { allowed: false, effectiveStatus: "blocked", reason: "readiness report is stale" };
  }

  const integrity = verifyEvidenceBindings(report.evidence, evidence);
  if (!integrity.valid) {
    return { allowed: false, effectiveStatus: "blocked", reason: integrity.reason };
  }

  const recalculated = buildDeployReadiness({
    health: evidence.health,
    risk: evidence.risk,
    autonomyState: evidence.autonomyState,
    checkedAt: report.checkedAt,
  });
  if (report.status !== recalculated.status || report.canAutoDeploy !== recalculated.canAutoDeploy) {
    return {
      allowed: false,
      effectiveStatus: "blocked",
      reason: "readiness status does not match the bound governance evidence",
    };
  }

  const { status } = report;
  if (status === "blocked") {
    return { allowed: false, effectiveStatus: "blocked", reason: "readiness is blocked" };
  }

  if (status === "ready") {
    return { allowed: true, effectiveStatus: "ready", reason: "readiness is ready and evidence-matched" };
  }

  if (status === "review-required") {
    if (trigger === "workflow_dispatch" && supervisedOverride === true) {
      return {
        allowed: true,
        effectiveStatus: "review-required",
        reason: "review-required deployment explicitly approved by a supervised manual run",
      };
    }

    return {
      allowed: false,
      effectiveStatus: "review-required",
      reason: "review-required deployment needs an explicit supervised manual override",
    };
  }

  return {
    allowed: false,
    effectiveStatus: "blocked",
    reason: `unknown readiness status: ${status ?? "missing"}`,
  };
}

export function parseMaxReadinessAgeHours(value) {
  if (value == null || value.trim() === "") {
    return DEFAULT_MAX_READINESS_AGE_HOURS;
  }

  return Number(value);
}

async function main() {
  const decision = await evaluateCurrentDeploymentPolicy({
    trigger: process.env.GITHUB_EVENT_NAME,
    supervisedOverride: process.env.XLB_SUPERVISED_REVIEW_OVERRIDE === "true",
    maxAgeHours: parseMaxReadinessAgeHours(process.env.XLB_DEPLOY_READINESS_MAX_AGE_HOURS),
  });

  console.log(`Deploy policy: ${decision.allowed ? "allowed" : "denied"} (${decision.reason})`);
  if (!decision.allowed) {
    throw new Error(`Production deployment denied: ${decision.reason}`);
  }
}

export async function evaluateCurrentDeploymentPolicy({
  trigger,
  supervisedOverride = false,
  now = Date.now(),
  maxAgeHours = DEFAULT_MAX_READINESS_AGE_HOURS,
} = {}) {
  const [report, health, risk, autonomyState] = await Promise.all([
    readJsonIfExists(READINESS_FILE),
    readJsonIfExists(HEALTH_FILE),
    readJsonIfExists(RISK_FILE),
    readJsonIfExists(AUTONOMY_STATE_FILE),
  ]);
  return evaluateDeploymentPolicy({
    report,
    evidence: { health, risk, autonomyState },
    trigger,
    supervisedOverride,
    now,
    maxAgeHours,
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
