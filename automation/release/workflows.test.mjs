import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const refreshFile = new URL("../../.github/workflows/refresh-live-analytics.yml", import.meta.url);
const deployFile = new URL("../../.github/workflows/deploy.yml", import.meta.url);
const buildFile = new URL("../../.github/workflows/build.yml", import.meta.url);
const promotionFiles = [
  "refresh-news.yml",
  "refresh-sports.yml",
  "refresh-tech.yml",
  "refresh-video.yml",
  "refresh-quotes.yml",
].map((name) => new URL(`../../.github/workflows/${name}`, import.meta.url));

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
  assert.match(workflow, /automation\/snapshots\/search-console-queries-\$\{XLB_SNAPSHOT_DATE\}\.json/);
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
    "- name: Dispatch validated release handoff",
  ]);
  assert.doesNotMatch(workflow, /XLB_FAIL_ON_DEGRADED_SOURCES:\s*["']?0/);
  assert.doesNotMatch(workflow, /XLB_FAIL_ON_HIGH_RISK:\s*["']?0/);
  assert.match(workflow, /public\/content\/earthquakes\/current\.json/);
});

test("deploy uses separate automatic and supervised exact-SHA handoffs", async () => {
  const workflow = await readFile(deployFile, "utf8");
  const triggers = workflow.slice(workflow.indexOf("on:\n"), workflow.indexOf("\npermissions:"));

  assert.doesNotMatch(triggers, /workflow_run:/);
  assert.match(triggers, /repository_dispatch:\n\s+types:\n\s+- validated-release/);
  assert.match(triggers, /workflow_dispatch:/);
  assert.match(triggers, /release_sha:[\s\S]*required: true/);
  assert.doesNotMatch(triggers, /\n  push:/);
  assert.doesNotMatch(triggers, /schedule:|pull_request:/);
  assert.match(workflow, /github\.event\.client_payload\.release_sha/);
  assert.match(workflow, /inputs\.release_sha/);
  assert.match(workflow, /ref: main/);
  assert.doesNotMatch(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /github\.event\.workflow_run/);
  assert.match(workflow, /npm run automation:verify-release-sha/);
  assert.match(workflow, /npm run automation:resolve-production-release/);
  assert.match(workflow, /npm run automation:classify-release/);
  assert.match(workflow, /npm run automation:evaluate-release-handoff/);
  assert.match(workflow, /XLB_DEPLOY_READINESS_MAX_AGE_HOURS/);
  assert.match(workflow, /XLB_RELEASE_CLASSIFICATION: \$\{\{ steps\.classification\.outputs\.classification \}\}/);
  assert.match(workflow, /npm run automation:enforce-deploy-readiness/);
  assert.match(workflow, /permissions:\n\s+actions: read/);
  assert.match(workflow, /npm run release:build/);
  assert.match(workflow, /npm run verify:ga-build/);
  assert.match(workflow, /production-release-\$\{\{ env\.XLB_RELEASE_SHA \}\}/);
  assert.match(workflow, /npm run automation:write-production-release-state/);
  assert.match(workflow, /\*\*DEPLOYED\*\*/);
  assert.match(workflow, /Report no-op release/);
  assert.doesNotMatch(workflow, /automation:apply-opportunities/);
  assert.doesNotMatch(workflow, /automation:source-health/);
  assert.doesNotMatch(workflow, /automation:assess-live-risk/);
  assert.doesNotMatch(workflow, /automation:ops-summary/);
  assert.doesNotMatch(workflow, /ALLOW_SOFT_BETA_AUTO_DEPLOY/);
  ordered(workflow, [
    "- name: Verify and checkout exact release SHA",
    "- name: Resolve previously deployed exact SHA",
    "- name: Classify exact release range",
    "- name: Evaluate release handoff",
    "- name: Validate and build immutable release candidate",
    "- name: Enforce committed deploy readiness",
    "- name: Configure AWS credentials",
    "- name: Upload immutable assets",
    "- name: Invalidate CloudFront",
    "- name: Record deployed exact SHA",
    "- name: Publish production release state",
  ]);
});

test("content workflows dispatch only after an actual successful promotion push", async () => {
  for (const file of promotionFiles) {
    const workflow = await readFile(file, "utf8");
    ordered(workflow, [
      "- name: Commit manifest update",
      "- name: Push to main",
      "git push origin HEAD:main",
      "release_sha=$(git rev-parse HEAD)",
      "- name: Dispatch validated release handoff",
    ]);
    assert.match(workflow, /if: steps\.changes\.outputs\.changed == 'true'[\s\S]*XLB_RELEASE_SHA: \$\{\{ steps\.push\.outputs\.release_sha \}\}/);
    assert.equal((workflow.match(/automation:dispatch-release-handoff/g) ?? []).length, 1);
  }
});

test("snapshot-only analytics persistence never dispatches a release", async () => {
  const workflow = await readFile(refreshFile, "utf8");
  const persistJob = workflow.slice(
    workflow.indexOf("  persist-analytics:"),
    workflow.indexOf("  publish-content-candidate:"),
  );

  assert.doesNotMatch(persistJob, /dispatch-release-handoff|validated-release/);
  assert.equal((workflow.match(/automation:dispatch-release-handoff/g) ?? []).length, 1);
});

test("successful human main build dispatches its exact push SHA", async () => {
  const workflow = await readFile(buildFile, "utf8");
  ordered(workflow, ["- name: Build site", "- name: Dispatch validated main release"]);
  assert.match(workflow, /release-handoff:\n\s+needs: build\n\s+if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /release-handoff:[\s\S]*permissions:\n\s+contents: write/);
  assert.match(workflow, /XLB_RELEASE_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /npm run automation:dispatch-release-handoff/);
});
