import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("earthquake experiment waits for an exact production deployment before measurement", async () => {
  const queue = JSON.parse(await readFile(new URL("./queue.json", import.meta.url), "utf8"));
  const schema = JSON.parse(await readFile(
    new URL("../contracts/experiment-queue.schema.json", import.meta.url),
    "utf8",
  ));
  const experiment = queue.items.find((item) => item.id === "earthquake-intelligence-v1");

  assert.deepEqual(experiment.measurementStart, {
    trigger: "actual-production-deployment",
    state: "awaiting-production-deployment",
    minimumDays: 14,
    productionReleaseSha: null,
    productionDeployedAt: null,
  });
  assert.match(experiment.notes, /no reported route-level search data rather than a confirmed numeric zero/);
  assert.equal(
    schema.properties.items.items.properties.measurementStart.properties.trigger.const,
    "actual-production-deployment",
  );
  assert.deepEqual(
    schema.properties.items.items.properties.measurementStart.required,
    ["trigger", "state", "minimumDays", "productionReleaseSha", "productionDeployedAt"],
  );
});
