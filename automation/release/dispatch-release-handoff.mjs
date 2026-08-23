import { assertReleaseSha } from "./verify-release-sha.mjs";

export async function dispatchValidatedRelease({
  releaseSha,
  source,
  repository,
  token,
  request = fetch,
}) {
  const normalizedSha = assertReleaseSha(releaseSha);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository ?? "")) {
    throw new Error("GITHUB_REPOSITORY must use owner/repository format");
  }
  if (!token) {
    throw new Error("GITHUB_TOKEN is required for release handoff");
  }

  const response = await request(`https://api.github.com/repos/${repository}/dispatches`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify({
      event_type: "validated-release",
      client_payload: {
        release_sha: normalizedSha,
        source: String(source || "unknown").slice(0, 100),
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Validated release dispatch failed: ${response.status}${detail ? ` ${detail}` : ""}`);
  }
  return normalizedSha;
}

async function main() {
  const releaseSha = await dispatchValidatedRelease({
    releaseSha: process.env.XLB_RELEASE_SHA,
    source: process.env.XLB_RELEASE_SOURCE,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
  });
  console.log(`Dispatched validated release handoff for ${releaseSha}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
