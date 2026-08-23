import test from "node:test";
import assert from "node:assert/strict";
import { verifyGaMeasurementBuild } from "./verify-ga-build.mjs";

const measurementId = "G-5JECBDGEMT";

test("configured GA measurement ID is present in every built route document", () => {
  assert.doesNotThrow(() => verifyGaMeasurementBuild({
    expectedMeasurementId: measurementId,
    documents: [
      { label: "index.html", html: `<script src="?id=${measurementId}"></script>` },
      { label: "route.html", html: `<script>gtag("config", "${measurementId}")</script>` },
    ],
  }));
});

test("unresolved or missing GA measurement ID is rejected", () => {
  assert.throws(
    () => verifyGaMeasurementBuild({
      expectedMeasurementId: measurementId,
      documents: [{ label: "index.html", html: "%VITE_GA_MEASUREMENT_ID%" }],
    }),
    /unresolved/,
  );
  assert.throws(
    () => verifyGaMeasurementBuild({
      expectedMeasurementId: measurementId,
      documents: [{ label: "index.html", html: "<html></html>" }],
    }),
    /does not contain/,
  );
});
