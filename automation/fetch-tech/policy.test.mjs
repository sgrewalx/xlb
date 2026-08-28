import assert from "node:assert/strict";
import test from "node:test";
import {
  assessTechArticle,
  buildTechSelection,
  selectTopTechArticles,
} from "./policy.mjs";
import { validateTechFreshness } from "../../scripts/validate-content.mjs";

const REFERENCE_TIME = "2026-08-28T12:00:00.000Z";

function article(source, publishedAt, title = `${source} current story`) {
  return {
    id: `${source}-${publishedAt}`,
    title,
    source,
    url: `https://example.com/${encodeURIComponent(source)}/${encodeURIComponent(title)}`,
    tag: "Technology",
    publishedAt,
    summary: "Summary",
    whyItMatters: "Why it matters",
  };
}

test("fresh articles retain source diversity while a stale source is excluded", () => {
  const selected = selectTopTechArticles([
    article("Source A", "2026-08-28T11:00:00.000Z"),
    article("Source B", "2026-08-28T10:00:00.000Z"),
    article("Source C", "2026-08-28T09:00:00.000Z"),
    article("Stale Source", "2023-03-25T13:31:00.000Z", "Biden TikTok story"),
  ], 4, REFERENCE_TIME);

  assert.deepEqual(selected.map((item) => item.source), ["Source A", "Source B", "Source C"]);
});

test("stale stored fallback content is never reused", () => {
  assert.throws(
    () => buildTechSelection({
      articles: [article("Fresh A", "2026-08-28T11:00:00.000Z")],
      existingTop3: {
        items: [article("Stored Stale", "2023-03-25T13:31:00.000Z")],
      },
      existingExpanded: { items: [] },
      referenceTime: REFERENCE_TIME,
    }),
    /Expected at least 3 fresh Tech articles, received 1/,
  );
});

test("a source contributes its fresh item but not its stale item", () => {
  const selected = selectTopTechArticles([
    article("Mixed Source", "2023-03-25T13:31:00.000Z", "Old story"),
    article("Mixed Source", "2026-08-28T11:30:00.000Z", "Current story"),
    article("Source B", "2026-08-28T10:00:00.000Z"),
    article("Source C", "2026-08-28T09:00:00.000Z"),
  ], 3, REFERENCE_TIME);

  assert.equal(selected.length, 3);
  assert.ok(selected.some((item) => item.title === "Current story"));
  assert.ok(!selected.some((item) => item.title === "Old story"));
});

test("implausibly future-dated and explicitly promotional items are excluded", () => {
  const selected = selectTopTechArticles([
    article("Future Source", "2026-08-29T12:00:00.000Z"),
    article("Promo Source", "2026-08-28T11:00:00.000Z", "Uber Eats Promo Codes: $15 Off"),
    article("News Source", "2026-08-28T10:00:00.000Z"),
  ], 3, REFERENCE_TIME);

  assert.deepEqual(selected.map((item) => item.source), ["News Source"]);
});

test("freshness boundary is inclusive and deterministic", () => {
  const atBoundary = article("Boundary", "2026-08-25T12:00:00.000Z");
  const justInside = article("Inside", "2026-08-25T12:00:00.001Z");
  const justOutside = article("Outside", "2026-08-25T11:59:59.999Z");

  assert.equal(assessTechArticle(atBoundary, REFERENCE_TIME).eligible, true);
  assert.equal(assessTechArticle(justInside, REFERENCE_TIME).eligible, true);
  assert.deepEqual(assessTechArticle(justOutside, REFERENCE_TIME), {
    eligible: false,
    reason: "stale",
  });
});

test("Tech manifest validation rejects stale content relative to updatedAt", () => {
  assert.throws(
    () => validateTechFreshness({
      updatedAt: REFERENCE_TIME,
      items: [article("Stale Source", "2023-03-25T13:31:00.000Z")],
    }, "tech/top.json"),
    /item 0 is not eligible Tech content \(stale\)/,
  );
});

test("three fresh articles satisfy the full selection contract", () => {
  const result = buildTechSelection({
    articles: [
      article("Source A", "2026-08-28T11:00:00.000Z"),
      article("Source B", "2026-08-28T10:00:00.000Z"),
      article("Source C", "2026-08-28T09:00:00.000Z"),
    ],
    existingTop3: { items: [] },
    existingExpanded: { items: [] },
    referenceTime: REFERENCE_TIME,
  });

  assert.equal(result.top3.length, 3);
  assert.deepEqual(result.top3, result.expanded);
});
