import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { assertReleaseSha } from "./verify-release-sha.mjs";

export function buildProductionReleaseState({ releaseSha, deployedAt, workflowRunId }) {
  const normalizedSha = assertReleaseSha(releaseSha);
  const timestamp = new Date(deployedAt);
  if (!Number.isFinite(timestamp.valueOf())) {
    throw new Error("Production release deployedAt is invalid");
  }
  if (!/^\d+$/.test(String(workflowRunId ?? ""))) {
    throw new Error("Production release workflowRunId is invalid");
  }

  return {
    schemaVersion: 1,
    releaseSha: normalizedSha,
    deployedAt: timestamp.toISOString(),
    workflowRunId: String(workflowRunId),
  };
}

async function main() {
  const outputPath = resolve(process.env.XLB_PRODUCTION_RELEASE_STATE_PATH || ".release-state/production-release.json");
  const state = buildProductionReleaseState({
    releaseSha: process.env.XLB_RELEASE_SHA,
    deployedAt: new Date().toISOString(),
    workflowRunId: process.env.GITHUB_RUN_ID,
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(`Recorded deployed exact SHA ${state.releaseSha}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
