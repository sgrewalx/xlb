import { execFileSync } from "node:child_process";
import { appendFile, writeFile } from "node:fs/promises";
import { assertReleaseSha } from "./verify-release-sha.mjs";

export const CONTENT_ONLY_ALLOWLIST = Object.freeze([
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

const CONTENT_CHANGE_TYPES = new Set(["A", "M"]);

export function isContentOnlyPath(filePath) {
  return CONTENT_ONLY_ALLOWLIST.includes(filePath);
}

export function parseNameStatus(output) {
  const fields = output.split("\0").filter(Boolean);
  const entries = [];

  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!status) {
      throw new Error("Git diff contained an empty change status");
    }

    if (status.startsWith("R") || status.startsWith("C")) {
      const previousPath = fields[index++];
      const path = fields[index++];
      if (!previousPath || !path) {
        throw new Error(`Git diff contained an incomplete ${status} entry`);
      }
      entries.push({ status, path, previousPath });
      continue;
    }

    const path = fields[index++];
    if (!path) {
      throw new Error(`Git diff contained an incomplete ${status} entry`);
    }
    entries.push({ status, path });
  }

  return entries;
}

export function classifyChangedEntries({ baseSha, releaseSha, entries, isAncestor = true }) {
  if (!isAncestor) {
    return result({
      baseSha,
      releaseSha,
      entries,
      classification: "blocked",
      reason: "deployed base SHA is not an ancestor of the requested release SHA",
    });
  }

  if (baseSha === releaseSha || entries.length === 0) {
    return result({
      baseSha,
      releaseSha,
      entries,
      classification: "no-op",
      reason: "requested release contains no changes after the deployed base",
    });
  }

  const unsupportedChanges = entries.filter(({ status }) => !CONTENT_CHANGE_TYPES.has(status));
  if (unsupportedChanges.length > 0) {
    return result({
      baseSha,
      releaseSha,
      entries,
      classification: "review-required",
      reason: "deletions, renames, copies, and type changes require supervised review",
      nonContentPaths: unsupportedChanges.map(({ path }) => path),
    });
  }

  const nonContentPaths = entries
    .map(({ path }) => path)
    .filter((filePath) => !isContentOnlyPath(filePath));
  if (nonContentPaths.length > 0) {
    return result({
      baseSha,
      releaseSha,
      entries,
      classification: "review-required",
      reason: "release contains paths outside the generated-content allowlist",
      nonContentPaths,
    });
  }

  return result({
    baseSha,
    releaseSha,
    entries,
    classification: "content-only",
    reason: "all changed paths are in the explicit generated-content allowlist",
  });
}

export function classifyGitRelease({ baseSha, releaseSha, runGit = git }) {
  let normalizedReleaseSha;
  try {
    normalizedReleaseSha = assertReleaseSha(releaseSha);
  } catch (error) {
    return result({
      baseSha: String(baseSha ?? ""),
      releaseSha: String(releaseSha ?? ""),
      entries: [],
      classification: "blocked",
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  if (!String(baseSha ?? "").trim()) {
    return result({
      baseSha: "",
      releaseSha: normalizedReleaseSha,
      entries: [],
      classification: "review-required",
      reason: "no authoritative previously deployed release SHA is available",
    });
  }

  let normalizedBaseSha;
  try {
    normalizedBaseSha = assertReleaseSha(baseSha);
  } catch (error) {
    return result({
      baseSha: String(baseSha ?? ""),
      releaseSha: normalizedReleaseSha,
      entries: [],
      classification: "blocked",
      reason: `invalid deployed base SHA: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  let isAncestor = true;
  try {
    runGit(["merge-base", "--is-ancestor", normalizedBaseSha, normalizedReleaseSha]);
  } catch {
    isAncestor = false;
  }

  if (!isAncestor) {
    return classifyChangedEntries({
      baseSha: normalizedBaseSha,
      releaseSha: normalizedReleaseSha,
      entries: [],
      isAncestor: false,
    });
  }

  let entries;
  try {
    entries = parseNameStatus(runGit([
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      normalizedBaseSha,
      normalizedReleaseSha,
      "--",
    ]));
  } catch (error) {
    return result({
      baseSha: normalizedBaseSha,
      releaseSha: normalizedReleaseSha,
      entries: [],
      classification: "blocked",
      reason: `release diff could not be determined: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return classifyChangedEntries({
    baseSha: normalizedBaseSha,
    releaseSha: normalizedReleaseSha,
    entries,
  });
}

function result({
  baseSha,
  releaseSha,
  entries,
  classification,
  reason,
  nonContentPaths = [],
}) {
  return {
    releaseSha,
    baseSha,
    changedFileCount: entries.length,
    changedPaths: entries.map(({ path }) => path),
    changes: entries,
    classification,
    reason,
    nonContentPaths: [...new Set(nonContentPaths)].sort(),
    autoDeployEligible: classification === "content-only",
  };
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function printClassification(classification) {
  console.log(`Release classification: ${classification.classification}`);
  console.log(`Base SHA: ${classification.baseSha || "unavailable"}`);
  console.log(`Release SHA: ${classification.releaseSha}`);
  console.log(`Changed paths: ${classification.changedFileCount}`);
  console.log(`Auto-deploy eligible: ${classification.autoDeployEligible ? "yes" : "no"}`);
  console.log(`Reason: ${classification.reason}`);
  for (const filePath of classification.nonContentPaths) {
    console.log(`Non-content path: ${filePath}`);
  }
}

async function main() {
  const [baseArgument, releaseArgument] = process.argv.slice(2);
  const classification = classifyGitRelease({
    baseSha: baseArgument ?? process.env.XLB_DEPLOYED_BASE_SHA,
    releaseSha: releaseArgument ?? process.env.XLB_RELEASE_SHA,
  });

  printClassification(classification);

  if (process.env.XLB_RELEASE_CLASSIFICATION_PATH) {
    await writeFile(
      process.env.XLB_RELEASE_CLASSIFICATION_PATH,
      `${JSON.stringify(classification, null, 2)}\n`,
      "utf8",
    );
  }
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      [
        `classification=${classification.classification}`,
        `base_sha=${classification.baseSha}`,
        `release_sha=${classification.releaseSha}`,
        `changed_file_count=${classification.changedFileCount}`,
        `auto_deploy_eligible=${classification.autoDeployEligible}`,
      ].join("\n") + "\n",
      "utf8",
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const reviewPaths = classification.nonContentPaths.length > 0
      ? `\n- Non-content paths:\n${classification.nonContentPaths.map((path) => `  - \`${path}\``).join("\n")}`
      : "";
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        "## Release classification",
        "",
        `- Classification: **${classification.classification}**`,
        `- Base SHA: \`${classification.baseSha || "unavailable"}\``,
        `- Release SHA: \`${classification.releaseSha}\``,
        `- Changed paths: ${classification.changedFileCount}`,
        `- Auto-deploy eligible: **${classification.autoDeployEligible ? "yes" : "no"}**`,
        `- Reason: ${classification.reason}${reviewPaths}`,
        "",
      ].join("\n"),
      "utf8",
    );
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
