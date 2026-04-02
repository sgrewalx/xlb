import test from "node:test";
import assert from "node:assert/strict";
import { buildContentAudit, buildImprovementQueue } from "./run.mjs";

test("content audit flags medium-risk zero-signal review pages", () => {
  const audit = buildContentAudit({
    updatedAt: "2026-04-02T00:00:00.000Z",
    events: [
      {
        slug: "artemis-ii",
        title: "Artemis II",
        topic: "launches",
      },
    ],
    topics: [
      {
        slug: "nasa",
        title: "Nasa",
        summary: "Automation monitors 1 event record in this topic. Current states: watch.",
      },
    ],
    scoreItems: [
      {
        slug: "artemis-ii",
        recommendation: "review",
        pageviews: 0,
        searchImpressions: 0,
      },
    ],
    health: {
      sources: [
        {
          id: "noaa-space-weather",
          stable: false,
        },
      ],
    },
    snapshot: {
      pages: [],
    },
  });

  assert.equal(audit.summary.findingCount, 4);
  assert.ok(audit.findings.some((item) => item.type === "generic_topic_summary"));
  assert.ok(audit.findings.some((item) => item.type === "normalize_topic_title"));
  assert.ok(audit.findings.some((item) => item.type === "strengthen_supporting_context"));
  assert.ok(audit.findings.some((item) => item.type === "source_stability_watch"));
});

test("improvement queue marks autofixable items as running", () => {
  const queue = buildImprovementQueue(
    {
      findings: [
        {
          id: "generic-summary-nasa",
          type: "generic_topic_summary",
          risk: "low",
          autofixEligible: true,
          targetPaths: ["/topics/nasa"],
          summary: "Needs better copy.",
        },
      ],
    },
    "2026-04-02T00:00:00.000Z",
  );

  assert.equal(queue.items.length, 1);
  assert.equal(queue.items[0].ownerAgent, "autofix-agent");
  assert.equal(queue.items[0].status, "running");
});
