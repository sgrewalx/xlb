import assert from "node:assert/strict";
import test from "node:test";
import { getSportsFallbackVisual } from "../src/lib/editorialVisuals.ts";

const GENERIC = "/media/sports/generic.svg";

test("sports fallback artwork matches only explicitly supported sports", () => {
  assert.equal(getSportsFallbackVisual("Football"), "/media/sports/football.svg");
  assert.equal(getSportsFallbackVisual("Basketball"), "/media/sports/basketball.svg");
  assert.equal(getSportsFallbackVisual("Tennis"), "/media/sports/tennis.svg");
});

test("unsupported and generic sports tags use neutral artwork", () => {
  for (const tag of [
    "Cricket",
    "Running",
    "Athletics",
    "Sports",
    "Baseball",
    "MLB",
    "NFL",
    "Motorsport",
    "Horse racing",
    "Underwater chessboxing",
  ]) {
    assert.equal(getSportsFallbackVisual(tag), GENERIC, `${tag} should use neutral artwork`);
  }
});

test("sports fallback normalization is case- and whitespace-insensitive", () => {
  assert.equal(getSportsFallbackVisual("  FOOTBALL  "), "/media/sports/football.svg");
  assert.equal(getSportsFallbackVisual("  unknown  "), GENERIC);
});
