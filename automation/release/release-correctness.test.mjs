import test from "node:test";
import assert from "node:assert/strict";
import { runValidatedBuild } from "./build-validated-candidate.mjs";
import { runCandidatePipeline } from "./run-content-candidate.mjs";
import { isPromotablePath } from "./validate-candidate-change-set.mjs";

test("analytics persistence remains complete when downstream homepage generation fails", async () => {
  const durableSnapshots = [];
  const workflowArtifacts = [];

  await assert.rejects(
    async () => {
      durableSnapshots.push("ga4", "search-console", "merged");
      workflowArtifacts.push("search-console-queries");
      await runCandidatePipeline({
        steps: [{ id: "homepage" }],
        failStep: "homepage",
        runStep: async () => {},
        validateAndBuild: async () => {},
      });
    },
    /Injected candidate failure at homepage/,
  );

  assert.deepEqual(durableSnapshots, ["ga4", "search-console", "merged"]);
  assert.deepEqual(workflowArtifacts, ["search-console-queries"]);
});

test("invalid candidate is not promoted and last-known-good content remains intact", async () => {
  let liveContent = "last-known-good";
  let promoted = false;

  await assert.rejects(
    runCandidatePipeline({
      steps: [{ id: "homepage" }],
      runStep: async () => {},
      validateAndBuild: async () => {
        throw new Error("candidate validation failed");
      },
      promoteCandidate: async () => {
        promoted = true;
        liveContent = "invalid-candidate";
      },
    }),
    /candidate validation failed/,
  );

  assert.equal(promoted, false);
  assert.equal(liveContent, "last-known-good");
});

test("validated candidate is promoted only after validation and build", async () => {
  const order = [];
  await runCandidatePipeline({
    steps: [{ id: "generate" }],
    runStep: async () => order.push("generate"),
    assertPromotable: async () => order.push("change-set"),
    validateAndBuild: async () => order.push("validate-build"),
    promoteCandidate: async () => order.push("promote"),
  });
  assert.deepEqual(order, ["generate", "change-set", "validate-build", "promote"]);
});

test("candidate promotion allowlist rejects release code and accepts generated surfaces", () => {
  assert.equal(isPromotablePath("public/content/home/modules.json"), true);
  assert.equal(isPromotablePath("public/content/earthquakes/current.json"), true);
  assert.equal(isPromotablePath("public/content/earthquakes/archive.json"), false);
  assert.equal(isPromotablePath("automation/snapshots/search-console-queries-2026-09-03.json"), false);
  assert.equal(isPromotablePath("automation/reports/deploy-readiness.json"), true);
  assert.equal(isPromotablePath("automation/release/run-content-candidate.mjs"), false);
  assert.equal(isPromotablePath("package.json"), false);
});

test("mutation after validation is rejected", async () => {
  let state = "candidate";
  await assert.rejects(
    runValidatedBuild({
      fingerprint: async () => state,
      validate: async () => {},
      build: async () => {
        state = "mutated-after-validation";
      },
    }),
    /Build mutated tracked files after final validation/,
  );
});

test("validation itself must be read-only", async () => {
  let state = "candidate";
  await assert.rejects(
    runValidatedBuild({
      fingerprint: async () => state,
      validate: async () => {
        state = "validator-mutated-candidate";
      },
      build: async () => {},
    }),
    /Final validation mutated tracked release-candidate files/,
  );
});
