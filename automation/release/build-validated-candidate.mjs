import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function trackedStateFingerprint() {
  const headTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
  const status = execFileSync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    { encoding: "utf8" },
  );
  const diff = execFileSync("git", ["diff", "--binary", "HEAD", "--"], { encoding: "utf8" });
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256")
    .update(headTree)
    .update("\0")
    .update(status)
    .update("\0")
    .update(diff);
  for (const filePath of untracked) {
    hash.update("\0").update(filePath).update("\0").update(readFileSync(filePath));
  }
  return hash.digest("hex");
}

export async function runValidatedBuild({ validate, build, fingerprint = trackedStateFingerprint }) {
  const beforeValidation = await fingerprint();
  await validate();
  const validatedState = await fingerprint();

  if (validatedState !== beforeValidation) {
    throw new Error("Final validation mutated tracked release-candidate files");
  }

  await build();
  const builtState = await fingerprint();
  if (builtState !== validatedState) {
    throw new Error("Build mutated tracked files after final validation");
  }

  return { validatedState };
}

function runNpm(script) {
  const result = spawnSync("npm", ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`npm run ${script} failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function main() {
  const result = await runValidatedBuild({
    validate: () => runNpm("validate:content"),
    build: () => runNpm("build:validated"),
  });
  console.log(`Built immutable validated candidate ${result.validatedState}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
