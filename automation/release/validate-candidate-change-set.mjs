import { execFileSync } from "node:child_process";

export const promotablePaths = [
  "public/content/live/",
  "public/content/topics/",
  "public/content/home/",
  "public/content/video/shorts.json",
  "public/content/games/",
  "public/content/gallery/",
  "public/content/earthquakes/current.json",
  "automation/reports/",
  "automation/experiments/",
  "public/sitemap.xml",
];

export function isPromotablePath(filePath) {
  return promotablePaths.some((allowed) =>
    allowed.endsWith("/") ? filePath.startsWith(allowed) : filePath === allowed,
  );
}

function gitPaths(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
}

export function assertPromotableCandidate() {
  const changedPaths = new Set([
    ...gitPaths(["diff", "--name-only", "-z", "HEAD", "--"]),
    ...gitPaths(["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  const unexpected = [...changedPaths].filter((filePath) => !isPromotablePath(filePath)).sort();

  if (unexpected.length > 0) {
    throw new Error(`Candidate changed non-promotable paths: ${unexpected.join(", ")}`);
  }

  console.log(`Candidate change set is promotable (${changedPaths.size} files)`);
}
