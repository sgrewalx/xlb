import test from "node:test";
import assert from "node:assert/strict";
import { resolveProductionRelease } from "./resolve-production-release.mjs";
import { buildProductionReleaseState } from "./write-production-release-state.mjs";

const SHA = "a".repeat(40);

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test("production base resolves only from a successful Deploy artifact", async () => {
  const requests = [];
  const release = await resolveProductionRelease({
    repository: "owner/repo",
    token: "token",
    request: async (url) => {
      requests.push(url);
      if (url.endsWith("/actions/artifacts?per_page=100")) {
        return response({ artifacts: [{
          id: 7,
          name: `production-release-${SHA}`,
          expired: false,
          created_at: "2026-08-31T10:00:00Z",
          workflow_run: { id: 42 },
        }] });
      }
      return response({
        path: ".github/workflows/deploy.yml",
        conclusion: "success",
      });
    },
  });

  assert.equal(release.releaseSha, SHA);
  assert.equal(release.workflowRunId, 42);
  assert.equal(requests.length, 2);
});

test("artifacts from failed or different workflows are not authoritative", async () => {
  const release = await resolveProductionRelease({
    repository: "owner/repo",
    token: "token",
    request: async (url) => {
      if (url.endsWith("/actions/artifacts?per_page=100")) {
        return response({ artifacts: [
          {
            id: 1,
            name: `production-release-${SHA}`,
            expired: false,
            created_at: "2026-08-31T10:00:00Z",
            workflow_run: { id: 11 },
          },
          {
            id: 2,
            name: `production-release-${"b".repeat(40)}`,
            expired: false,
            created_at: "2026-08-31T09:00:00Z",
            workflow_run: { id: 12 },
          },
        ] });
      }
      if (url.endsWith("/11")) {
        return response({ path: ".github/workflows/deploy.yml", conclusion: "failure" });
      }
      return response({ path: ".github/workflows/build.yml", conclusion: "success" });
    },
  });

  assert.equal(release, null);
});

test("production release state records an exact SHA and deterministic fields", () => {
  assert.deepEqual(buildProductionReleaseState({
    releaseSha: SHA.toUpperCase(),
    deployedAt: "2026-08-31T12:00:00Z",
    workflowRunId: 123,
  }), {
    schemaVersion: 1,
    releaseSha: SHA,
    deployedAt: "2026-08-31T12:00:00.000Z",
    workflowRunId: "123",
  });
});
