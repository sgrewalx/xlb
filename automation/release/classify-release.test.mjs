import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTENT_ONLY_ALLOWLIST,
  classifyChangedEntries,
  classifyGitRelease,
  parseNameStatus,
} from "./classify-release.mjs";

const BASE = "1".repeat(40);
const RELEASE = "2".repeat(40);

function classify(changes) {
  return classifyChangedEntries({ baseSha: BASE, releaseSha: RELEASE, entries: changes });
}

function modified(...paths) {
  return paths.map((path) => ({ status: "M", path }));
}

test("content-only allowlist is explicit and excludes executable and governance paths", () => {
  assert.deepEqual(CONTENT_ONLY_ALLOWLIST, [
    "public/content/news/top.json",
    "public/content/news/top3.json",
    "public/content/sports/top.json",
    "public/content/sports/top3.json",
    "public/content/tech/top.json",
    "public/content/tech/top3.json",
    "public/content/video/top.json",
    "public/content/video/top3.json",
    "public/content/video/shorts.json",
    "public/content/quotes/quotes.json",
    "public/content/gallery/collections.json",
    "public/content/gallery/visuals/aurora-kp.svg",
    "public/content/gallery/visuals/earthquake-activity.svg",
    "public/content/gallery/visuals/launch-timeline.svg",
    "public/content/gallery/visuals/topic-signals.svg",
    "public/content/live/events.json",
    "public/content/live/scoreboard.json",
    "public/content/home/modules.json",
    "public/content/games/catalog.json",
    "public/content/topics/index.json",
    "public/sitemap.xml",
  ]);
  assert.equal(classify(modified("automation/reports/deploy-readiness.json")).classification, "review-required");
  assert.equal(classify(modified("public/content/modules/modules.json")).classification, "review-required");
  assert.equal(classify(modified("public/content/news/new.json")).classification, "review-required");
});

test("news manifest only is content-only", () => {
  assert.equal(classify(modified("public/content/news/top.json")).classification, "content-only");
});

test("sports and tech manifests are content-only", () => {
  assert.equal(classify(modified(
    "public/content/sports/top.json",
    "public/content/tech/top3.json",
  )).classification, "content-only");
});

test("multiple generated content directories are content-only", () => {
  assert.equal(classify(modified(
    "public/content/news/top.json",
    "public/content/sports/top.json",
    "public/content/tech/top.json",
    "public/content/video/top.json",
  )).classification, "content-only");
});

test("gallery generated SVG and content are content-only", () => {
  assert.equal(classify(modified(
    "public/content/gallery/collections.json",
    "public/content/gallery/visuals/aurora-kp.svg",
  )).classification, "content-only");
});

test("code, workflow, lockfile, schema, validator, and unknown paths require review", () => {
  for (const path of [
    "src/components/EditorialFeed.tsx",
    ".github/workflows/deploy.yml",
    "package-lock.json",
    "automation/contracts/news.schema.json",
    "scripts/validate-content.mjs",
    "new-unknown-file.txt",
  ]) {
    const decision = classify(modified(path));
    assert.equal(decision.classification, "review-required", path);
    assert.deepEqual(decision.nonContentPaths, [path]);
  }
});

test("mixed content and code or workflow ranges require review", () => {
  assert.equal(classify(modified(
    "public/content/news/top.json",
    "src/App.tsx",
  )).classification, "review-required");
  assert.equal(classify(modified(
    "public/content/news/top.json",
    ".github/workflows/build.yml",
  )).classification, "review-required");
});

test("deletions and renames require review even inside generated content", () => {
  const deleted = classify([{ status: "D", path: "public/content/news/top.json" }]);
  assert.equal(deleted.classification, "review-required");
  assert.match(deleted.reason, /deletions/);

  const renamed = classify([{
    status: "R100",
    previousPath: "public/content/news/old.json",
    path: "public/content/news/new.json",
  }]);
  assert.equal(renamed.classification, "review-required");
});

test("non-ancestor history is blocked and empty diff is a no-op", () => {
  assert.equal(classifyChangedEntries({
    baseSha: BASE,
    releaseSha: RELEASE,
    entries: modified("public/content/news/top.json"),
    isAncestor: false,
  }).classification, "blocked");
  assert.equal(classify([]).classification, "no-op");
});

test("missing authoritative production base requires review", () => {
  const decision = classifyGitRelease({ baseSha: "", releaseSha: RELEASE });
  assert.equal(decision.classification, "review-required");
  assert.match(decision.reason, /authoritative/);
});

test("git name-status parser preserves additions, deletions, and renames", () => {
  assert.deepEqual(
    parseNameStatus("M\0public/content/news/top.json\0D\0old.json\0R100\0before.json\0after.json\0"),
    [
      { status: "M", path: "public/content/news/top.json" },
      { status: "D", path: "old.json" },
      { status: "R100", previousPath: "before.json", path: "after.json" },
    ],
  );
});
