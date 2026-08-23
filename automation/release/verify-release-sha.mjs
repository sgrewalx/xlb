import { execFileSync } from "node:child_process";

const SHA_PATTERN = /^[a-fA-F0-9]{40}$/;

export function assertReleaseSha(value) {
  const releaseSha = String(value ?? "").trim();
  if (!SHA_PATTERN.test(releaseSha)) {
    throw new Error("Release SHA must contain exactly 40 hexadecimal characters");
  }
  return releaseSha.toLowerCase();
}

export function verifyAndCheckoutReleaseSha({ releaseSha, runGit = git }) {
  const normalizedSha = assertReleaseSha(releaseSha);

  runGit(["cat-file", "-e", `${normalizedSha}^{commit}`]);
  runGit(["merge-base", "--is-ancestor", normalizedSha, "origin/main"]);
  runGit(["checkout", "--detach", normalizedSha]);
  const checkedOutSha = runGit(["rev-parse", "HEAD"]).trim().toLowerCase();

  if (checkedOutSha !== normalizedSha) {
    throw new Error(`Checked-out SHA does not match requested release SHA`);
  }
  return normalizedSha;
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const detail = error?.stderr?.toString().trim();
    throw new Error(`Release SHA verification failed${detail ? `: ${detail}` : ""}`);
  }
}

function main() {
  const releaseSha = verifyAndCheckoutReleaseSha({
    releaseSha: process.env.XLB_RELEASE_SHA,
  });
  console.log(`Checked out exact release SHA ${releaseSha}`);
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
