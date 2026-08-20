import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const refreshFile = new URL("../../.github/workflows/refresh-live-analytics.yml", import.meta.url);
const deployFile = new URL("../../.github/workflows/deploy.yml", import.meta.url);

function ordered(text, labels) {
  let previous = -1;
  for (const label of labels) {
    const position = text.indexOf(label);
    assert.notEqual(position, -1, `missing workflow marker: ${label}`);
    assert.ok(position > previous, `workflow marker out of order: ${label}`);
    previous = position;
  }
}

test("analytics persistence is a separate prerequisite failure domain", async () => {
  const workflow = await readFile(refreshFile, "utf8");

  assert.match(workflow, /^  persist-analytics:/m);
  assert.match(workflow, /^  publish-content-candidate:/m);
  assert.match(workflow, /^    needs: persist-analytics$/m);
  assert.match(workflow, /git status --porcelain --untracked-files=all/);
  ordered(workflow, [
    "- name: Validate analytics snapshots",
    "- name: Commit validated analytics snapshots",
    "- name: Persist analytics to main",
    "publish-content-candidate:",
    "- name: Generate and validate content candidate",
  ]);
});

test("content promotion can only occur after the complete candidate passes", async () => {
  const workflow = await readFile(refreshFile, "utf8");

  ordered(workflow, [
    "- name: Generate and validate content candidate",
    "- name: Detect candidate changes",
    "- name: Promote validated content candidate",
    "- name: Publish exact validated candidate to main",
  ]);
  assert.doesNotMatch(workflow, /XLB_FAIL_ON_DEGRADED_SOURCES:\s*["']?0/);
  assert.doesNotMatch(workflow, /XLB_FAIL_ON_HIGH_RISK:\s*["']?0/);
});

test("deploy performs no production-affecting mutation after validation", async () => {
  const workflow = await readFile(deployFile, "utf8");

  assert.match(workflow, /npm run automation:enforce-deploy-readiness/);
  assert.match(workflow, /npm run release:build/);
  assert.doesNotMatch(workflow, /automation:apply-opportunities/);
  assert.doesNotMatch(workflow, /automation:source-health/);
  assert.doesNotMatch(workflow, /automation:assess-live-risk/);
  assert.doesNotMatch(workflow, /automation:ops-summary/);
  assert.doesNotMatch(workflow, /ALLOW_SOFT_BETA_AUTO_DEPLOY/);
  ordered(workflow, [
    "- name: Enforce committed deploy readiness",
    "- name: Validate and build immutable release candidate",
    "- name: Configure AWS credentials",
    "- name: Upload immutable assets",
  ]);
});
