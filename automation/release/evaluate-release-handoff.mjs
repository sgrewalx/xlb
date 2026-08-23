import { appendFile } from "node:fs/promises";
import {
  evaluateCurrentDeploymentPolicy,
  parseMaxReadinessAgeHours,
} from "../governance/enforce-deploy-readiness.mjs";

export function handoffDisposition(decision) {
  if (decision.allowed) {
    return "deploy";
  }
  if (decision.effectiveStatus === "review-required") {
    return "awaiting-approval";
  }
  return "blocked";
}

async function main() {
  const decision = await evaluateCurrentDeploymentPolicy({
    trigger: process.env.GITHUB_EVENT_NAME,
    supervisedOverride: process.env.XLB_SUPERVISED_REVIEW_OVERRIDE === "true",
    maxAgeHours: parseMaxReadinessAgeHours(process.env.XLB_DEPLOY_READINESS_MAX_AGE_HOURS),
  });
  const disposition = handoffDisposition(decision);

  console.log(`Release handoff: ${disposition} (${decision.reason})`);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `disposition=${disposition}\n`, "utf8");
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Release handoff\n\n- Disposition: **${disposition}**\n- Reason: ${decision.reason}\n`,
      "utf8",
    );
  }

  if (disposition === "blocked") {
    throw new Error(`Release handoff blocked: ${decision.reason}`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
