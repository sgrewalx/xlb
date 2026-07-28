import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";

async function snapshotWorkingTree() {
  const status = git(["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const trackedDiff = git(["diff", "--binary", "HEAD", "--"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"])
    .split("\0")
    .filter(Boolean)
    .sort();
  const untrackedHashes = [];

  for (const filePath of untracked) {
    const contents = await readFile(filePath);
    untrackedHashes.push([
      filePath,
      createHash("sha256").update(contents).digest("hex"),
    ]);
  }

  return JSON.stringify({ status, trackedDiff, untrackedHashes });
}

function git(arguments_) {
  return execFileSync("git", arguments_, { encoding: "utf8" });
}

const before = await snapshotWorkingTree();
const result = spawnSync("npm", ["test"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  const after = await snapshotWorkingTree();
  if (after !== before) {
    console.error("Test suite changed the Git working tree.");
    process.exitCode = 1;
  } else {
    console.log("Test suite left the Git working tree unchanged.");
  }
}
