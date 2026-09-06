import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboard = await readFile(new URL("../src/pages/OpsDashboardPage.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");

test("local Ops dashboard exposes Progress, Experiments, and Automation views", () => {
  for (const label of ["Progress", "Experiments", "Automation", "earthquake-intelligence-v1"]) {
    if (label === "earthquake-intelligence-v1") {
      assert.match(dashboard, /loadMatching\(experimentModules, "\/queue\.json"\)/);
    } else {
      assert.match(dashboard, new RegExp(`"${label.toLowerCase()}"`));
    }
  }
  assert.match(dashboard, /automation\/progress\/weekly/);
  assert.match(dashboard, /productionReleaseSha/);
});

test("Ops dashboard never imports raw Search Console query evidence", () => {
  assert.doesNotMatch(dashboard, /search-console-queries/);
  assert.doesNotMatch(dashboard, /\.query\b|raw quer/i);
});

test("Ops route remains development-only", () => {
  assert.match(app, /const OpsDashboardPage = import\.meta\.env\.DEV/);
  assert.match(app, /const isOpsView = import\.meta\.env\.DEV && location\.pathname === "\/__ops"/);
  assert.match(app, /\{OpsDashboardPage \? \(/);
});
