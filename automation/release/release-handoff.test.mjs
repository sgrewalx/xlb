import test from "node:test";
import assert from "node:assert/strict";
import { dispatchValidatedRelease } from "./dispatch-release-handoff.mjs";
import { handoffDisposition } from "./evaluate-release-handoff.mjs";
import { assertReleaseSha, verifyAndCheckoutReleaseSha } from "./verify-release-sha.mjs";

const SHA = "A".repeat(40);
const NORMALIZED_SHA = SHA.toLowerCase();

test("release SHA accepts exactly 40 hexadecimal characters", () => {
  assert.equal(assertReleaseSha(SHA), NORMALIZED_SHA);
  assert.throws(() => assertReleaseSha("abc"), /exactly 40/);
  assert.throws(() => assertReleaseSha("g".repeat(40)), /exactly 40/);
});

test("release SHA must exist on main before detached checkout", () => {
  const calls = [];
  assert.throws(
    () => verifyAndCheckoutReleaseSha({
      releaseSha: SHA,
      runGit: (args) => {
        calls.push(args);
        if (args[0] === "merge-base") {
          throw new Error("not an ancestor");
        }
        return "";
      },
    }),
    /not an ancestor/,
  );
  assert.deepEqual(calls, [
    ["cat-file", "-e", `${NORMALIZED_SHA}^{commit}`],
    ["merge-base", "--is-ancestor", NORMALIZED_SHA, "origin/main"],
  ]);
});

test("checkout SHA mismatch is rejected", () => {
  assert.throws(
    () => verifyAndCheckoutReleaseSha({
      releaseSha: SHA,
      runGit: (args) => args[0] === "rev-parse" ? `${"b".repeat(40)}\n` : "",
    }),
    /does not match/,
  );
});

test("verified release checks out the requested SHA detached", () => {
  const calls = [];
  assert.equal(
    verifyAndCheckoutReleaseSha({
      releaseSha: SHA,
      runGit: (args) => {
        calls.push(args);
        return args[0] === "rev-parse" ? `${NORMALIZED_SHA}\n` : "";
      },
    }),
    NORMALIZED_SHA,
  );
  assert.deepEqual(calls[2], ["checkout", "--detach", NORMALIZED_SHA]);
});

test("repository dispatch carries the exact release SHA and source", async () => {
  let request;
  const releaseSha = await dispatchValidatedRelease({
    releaseSha: SHA,
    source: "refresh-news",
    repository: "owner/repo",
    token: "test-token",
    request: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 204 };
    },
  });

  assert.equal(releaseSha, NORMALIZED_SHA);
  assert.equal(request.url, "https://api.github.com/repos/owner/repo/dispatches");
  assert.deepEqual(JSON.parse(request.options.body), {
    event_type: "validated-release",
    client_payload: {
      release_sha: NORMALIZED_SHA,
      source: "refresh-news",
    },
  });
});

test("invalid release SHA never dispatches", async () => {
  let called = false;
  await assert.rejects(
    dispatchValidatedRelease({
      releaseSha: "main",
      source: "test",
      repository: "owner/repo",
      token: "test-token",
      request: async () => {
        called = true;
        return { ok: true };
      },
    }),
    /exactly 40/,
  );
  assert.equal(called, false);
});

test("handoff maps shared policy decisions without weakening them", () => {
  assert.equal(handoffDisposition({ allowed: true, effectiveStatus: "ready" }), "deploy");
  assert.equal(
    handoffDisposition({ allowed: false, effectiveStatus: "review-required" }),
    "awaiting-approval",
  );
  assert.equal(handoffDisposition({ allowed: false, effectiveStatus: "blocked" }), "blocked");
  assert.equal(handoffDisposition({ allowed: false, effectiveStatus: "no-op" }), "no-op");
});
