import { appendFile } from "node:fs/promises";
import { assertReleaseSha } from "./verify-release-sha.mjs";

const ARTIFACT_PREFIX = "production-release-";

export async function resolveProductionRelease({ repository, token, request = fetch }) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository ?? "")) {
    throw new Error("GITHUB_REPOSITORY must use owner/repository format");
  }
  if (!token) {
    throw new Error("GITHUB_TOKEN is required to resolve the production release");
  }

  const artifacts = await requestJson(
    request,
    `https://api.github.com/repos/${repository}/actions/artifacts?per_page=100`,
    token,
  );
  const candidates = (artifacts.artifacts ?? [])
    .filter((artifact) => !artifact.expired && artifact.name?.startsWith(ARTIFACT_PREFIX))
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));

  for (const artifact of candidates) {
    const releaseSha = artifact.name.slice(ARTIFACT_PREFIX.length);
    try {
      assertReleaseSha(releaseSha);
    } catch {
      continue;
    }

    const runId = artifact.workflow_run?.id;
    if (!Number.isInteger(runId)) {
      continue;
    }
    const run = await requestJson(
      request,
      `https://api.github.com/repos/${repository}/actions/runs/${runId}`,
      token,
    );
    if (run.path !== ".github/workflows/deploy.yml" || run.conclusion !== "success") {
      continue;
    }

    return {
      releaseSha: releaseSha.toLowerCase(),
      artifactId: artifact.id,
      artifactName: artifact.name,
      workflowRunId: runId,
      createdAt: artifact.created_at,
      source: "successful Deploy workflow production-release artifact",
    };
  }

  return null;
}

async function requestJson(request, url, token) {
  const response = await request(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub release-state lookup failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }
  return response.json();
}

async function writeOutputs(release, reason) {
  const output = release
    ? [
        `base_sha=${release.releaseSha}`,
        `artifact_id=${release.artifactId}`,
        `workflow_run_id=${release.workflowRunId}`,
        `base_source=${release.source}`,
      ]
    : ["base_sha=", "artifact_id=", "workflow_run_id=", `base_source=${reason}`];
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `${output.join("\n")}\n`, "utf8");
  }
}

async function main() {
  try {
    const release = await resolveProductionRelease({
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN,
    });
    if (release) {
      console.log(`Previously deployed release SHA: ${release.releaseSha}`);
      console.log(`Production base source: ${release.source} (run ${release.workflowRunId})`);
      await writeOutputs(release, "");
      return;
    }

    const reason = "no successful production-release artifact is available; supervised bootstrap required";
    console.log(`Previously deployed release SHA: unavailable (${reason})`);
    await writeOutputs(null, reason);
  } catch (error) {
    const reason = `production release state is unavailable: ${error instanceof Error ? error.message : String(error)}`;
    console.log(reason);
    await writeOutputs(null, reason);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
