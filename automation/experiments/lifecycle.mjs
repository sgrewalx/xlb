import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import { validateExperimentQueue } from "./model.mjs";

const QUEUE_FILE = new URL("./queue.json", import.meta.url);

export async function bindProductionDeployment(queue, release, { containsCommit, containsPath } = {}) {
  validateRelease(release);
  const commitCheck = containsCommit ?? ((commit, releaseSha) => gitSucceeds(["merge-base", "--is-ancestor", commit, releaseSha]));
  const pathCheck = containsPath ?? ((path, releaseSha) => gitSucceeds(["cat-file", "-e", `${releaseSha}:${path}`]));
  let changed = false;
  const items = [];

  for (const item of queue.items) {
    if (item.status !== "awaiting-production-deployment") {
      items.push(item);
      continue;
    }
    if (!item.implementation) {
      items.push(withDiagnostic(item, "Deployment binding is ambiguous: no implementation metadata is recorded."));
      changed ||= item.measurementStart.diagnostic !== items.at(-1).measurementStart.diagnostic;
      continue;
    }

    const commitMatches = await commitCheck(item.implementation.introducedBySha, release.releaseSha);
    const pathsMatch = commitMatches && (await Promise.all(
      item.implementation.requiredPaths.map((path) => pathCheck(path, release.releaseSha)),
    )).every(Boolean);
    if (!commitMatches || !pathsMatch) {
      const diagnostic = commitMatches
        ? "Exact release contains the implementation commit but not every required path; measurement remains pending."
        : "Exact release does not contain the bound implementation commit; measurement remains pending.";
      items.push(withDiagnostic(item, diagnostic));
      changed ||= item.measurementStart.diagnostic !== diagnostic;
      continue;
    }

    changed = true;
    items.push({
      ...item,
      status: "measuring",
      measurementStart: {
        ...item.measurementStart,
        state: "measuring",
        productionReleaseSha: release.releaseSha,
        productionDeployedAt: release.deployedAt,
        diagnostic: "Bound by implementation commit ancestry and required paths in the exact deployed release.",
      },
      measurement: {
        ...item.measurement,
        capturedAt: release.deployedAt,
        asOf: release.deployedAt,
        daysElapsed: 0,
        evidenceSufficient: false,
        evidenceState: "not-yet-comparable",
        evidenceWindows: {
          ga4: emptyEvidenceWindow("ga4"),
          searchConsole: emptyEvidenceWindow("search-console"),
        },
      },
    });
  }

  const result = { ...queue, updatedAt: changed ? release.deployedAt : queue.updatedAt, items };
  validateExperimentQueue(result);
  return { queue: result, changed };
}

function emptyEvidenceWindow(source) {
  return { start: null, end: null, source, complete: false, reason: "Awaiting a complete post-deployment source period." };
}

function withDiagnostic(item, diagnostic) {
  return { ...item, measurementStart: { ...item.measurementStart, diagnostic } };
}

function validateRelease(release) {
  if (!/^[0-9a-f]{40}$/.test(release?.releaseSha ?? "")) throw new Error("Production release SHA is invalid");
  if (!Number.isFinite(Date.parse(release?.deployedAt ?? ""))) throw new Error("Production deployment timestamp is invalid");
}

function gitSucceeds(args) {
  try {
    execFileSync("git", args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const statePath = process.env.XLB_PRODUCTION_RELEASE_STATE_PATH;
  if (!statePath) throw new Error("XLB_PRODUCTION_RELEASE_STATE_PATH is required");
  const [queue, release] = await Promise.all([
    readFile(QUEUE_FILE, "utf8").then(JSON.parse),
    readFile(statePath, "utf8").then(JSON.parse),
  ]);
  const expectedRunId = process.env.XLB_EXPECTED_DEPLOY_WORKFLOW_RUN_ID;
  if (expectedRunId && String(release.workflowRunId) !== expectedRunId) {
    throw new Error("Production release state does not belong to the triggering Deploy run");
  }
  const result = await bindProductionDeployment(validateExperimentQueue(queue), release);
  if (result.changed) await writeJsonIfChanged(QUEUE_FILE, result.queue);
  console.log(result.changed ? `Bound experiment lifecycle to ${release.releaseSha}` : "No pending experiment matched the exact deployment");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
