import assert from "node:assert/strict";
import test from "node:test";
import { buildQueue } from "./run.mjs";
import { AUTO_APPLICABLE_SIGNALS, findEventForPath, selectAutoApplicableItems } from "../apply-traffic-opportunities/run.mjs";

test("opportunity signal survives queue conversion and reaches the apply selector", () => {
  const queue = buildQueue({
    updatedAt: "2026-09-06T00:00:00.000Z",
    inputQuality: { quality: "live-api", notes: "fixture" },
    opportunities: [{ id: "traffic-index-watch-example", signal: "index_watch", title: "Watch route", risk: "low", hypothesis: "A linked route can gain visibility.", path: "/topics/example", successMetric: "First impressions.", recommendation: "Keep linked." }],
  });
  assert.equal(queue.items[0].signal, "index_watch");
  assert.deepEqual(selectAutoApplicableItems(queue.items).map((item) => item.id), ["traffic-index-watch-example"]);
});

test("auto-applicable action set remains explicitly bounded", () => {
  assert.deepEqual(AUTO_APPLICABLE_SIGNALS, ["index_watch", "engagement_expand"]);
  assert.deepEqual(selectAutoApplicableItems([
    { id: "unknown", signal: "rewrite-code", risk: "low", status: "queued" },
    { id: "high", signal: "index_watch", risk: "high", status: "queued" },
  ]), []);
});

test("event promotion matches only the canonical event route", () => {
  const events = [{ slug: "example-event" }];
  assert.equal(findEventForPath(events, "/events/example-event"), events[0]);
  assert.equal(findEventForPath(events, "/example-event"), undefined);
  assert.equal(findEventForPath(events, "/events/../example-event"), undefined);
});
