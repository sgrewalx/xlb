import { readJsonIfExists } from "../shared/content-writer.mjs";

const READINESS_FILE = new URL("../../automation/reports/deploy-readiness.json", import.meta.url);

export function evaluateDeploymentPolicy({ status, trigger, supervisedOverride = false }) {
  if (status === "blocked") {
    return { allowed: false, reason: "readiness is blocked" };
  }

  if (status === "ready") {
    return { allowed: true, reason: "readiness is ready" };
  }

  if (status === "review-required") {
    if (trigger === "workflow_dispatch" && supervisedOverride === true) {
      return {
        allowed: true,
        reason: "review-required deployment explicitly approved by a supervised manual run",
      };
    }

    return {
      allowed: false,
      reason: "review-required deployment needs an explicit supervised manual override",
    };
  }

  return { allowed: false, reason: `unknown readiness status: ${status ?? "missing"}` };
}

async function main() {
  const report = await readJsonIfExists(READINESS_FILE);
  const decision = evaluateDeploymentPolicy({
    status: report?.status,
    trigger: process.env.GITHUB_EVENT_NAME,
    supervisedOverride: process.env.XLB_SUPERVISED_REVIEW_OVERRIDE === "true",
  });

  console.log(`Deploy policy: ${decision.allowed ? "allowed" : "denied"} (${decision.reason})`);
  if (!decision.allowed) {
    throw new Error(`Production deployment denied: ${decision.reason}`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
