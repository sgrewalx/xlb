import assert from "node:assert/strict";
import test from "node:test";
import { rankEditorialArticles } from "./editorial-ranking.mjs";

test("usable imagery breaks ties only inside the same freshness band", () => {
  const ranked = rankEditorialArticles([
    article("newest-no-image", "2026-08-29T10:00:00.000Z"),
    article("same-band-image", "2026-08-29T08:30:00.000Z", true),
    article("older-band-image", "2026-08-29T07:30:00.000Z", true),
  ]);

  assert.deepEqual(ranked.map((item) => item.id), [
    "same-band-image",
    "newest-no-image",
    "older-band-image",
  ]);
});

test("freshness and input order remain deterministic when image state is equal", () => {
  const ranked = rankEditorialArticles([
    article("older", "2026-08-29T09:00:00.000Z", true),
    article("newer", "2026-08-29T09:30:00.000Z", true),
    article("same-time-first", "2026-08-29T08:00:00.000Z"),
    article("same-time-second", "2026-08-29T08:00:00.000Z"),
  ]);

  assert.deepEqual(ranked.map((item) => item.id), [
    "newer",
    "older",
    "same-time-first",
    "same-time-second",
  ]);
});

function article(id, publishedAt, image = false) {
  return {
    id,
    publishedAt,
    ...(image ? { image: `https://images.example.com/${id}.jpg` } : {}),
  };
}
