import { readFile } from "node:fs/promises";
import path from "node:path";

const root = new URL("../public/content/", import.meta.url);

const files = [
  ["news/top3.json", validateTopFeed],
  ["sports/top3.json", validateTopFeed],
  ["quotes/quotes.json", validateQuotes],
  ["visuals/feed.json", validateVisuals],
  ["modules/modules.json", validateModules],
  ["live/events.json", validateLiveEvents],
  ["live/scoreboard.json", validateLiveScoreboard],
  ["topics/index.json", validateTopics],
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateTopFeed(json, label) {
  assert(isString(json.updatedAt), `${label}: updatedAt is required`);
  assert(Array.isArray(json.items), `${label}: items must be an array`);
  assert(json.items.length === 3, `${label}: items must contain exactly 3 entries`);

  json.items.forEach((item, index) => {
    assert(isString(item.id), `${label}: item ${index} id required`);
    assert(isString(item.title), `${label}: item ${index} title required`);
    assert(isString(item.source), `${label}: item ${index} source required`);
    assert(isString(item.url), `${label}: item ${index} url required`);
    assert(isString(item.tag), `${label}: item ${index} tag required`);
    assert(isString(item.publishedAt), `${label}: item ${index} publishedAt required`);
  });
}

function validateQuotes(json, label) {
  assert(isString(json.updatedAt), `${label}: updatedAt is required`);
  assert(Array.isArray(json.items) && json.items.length > 0, `${label}: items must exist`);

  json.items.forEach((item, index) => {
    assert(isString(item.id), `${label}: item ${index} id required`);
    assert(isString(item.quote), `${label}: item ${index} quote required`);
    assert(isString(item.author), `${label}: item ${index} author required`);
    assert(isString(item.context), `${label}: item ${index} context required`);
  });
}

function validateVisuals(json, label) {
  assert(isString(json.updatedAt), `${label}: updatedAt is required`);
  assert(Array.isArray(json.items) && json.items.length > 0, `${label}: items must exist`);

  json.items.forEach((item, index) => {
    assert(isString(item.id), `${label}: item ${index} id required`);
    assert(isString(item.title), `${label}: item ${index} title required`);
    assert(isString(item.category), `${label}: item ${index} category required`);
    assert(isString(item.image), `${label}: item ${index} image required`);
    assert(isString(item.alt), `${label}: item ${index} alt required`);
    assert(isString(item.credit), `${label}: item ${index} credit required`);
  });
}

function validateModules(json, label) {
  assert(isString(json.updatedAt), `${label}: updatedAt is required`);
  assert(Array.isArray(json.items) && json.items.length > 0, `${label}: items must exist`);

  json.items.forEach((item, index) => {
    assert(isString(item.id), `${label}: item ${index} id required`);
    assert(isString(item.title), `${label}: item ${index} title required`);
    assert(isString(item.description), `${label}: item ${index} description required`);
    assert(isString(item.provider), `${label}: item ${index} provider required`);
    assert(item.mode === "link" || item.mode === "summary", `${label}: item ${index} mode invalid`);
    assert(isString(item.image), `${label}: item ${index} image required`);
    assert(isString(item.actionLabel), `${label}: item ${index} actionLabel required`);
    assert(isString(item.actionUrl), `${label}: item ${index} actionUrl required`);
    assert(isString(item.safeNote), `${label}: item ${index} safeNote required`);
    assert(Array.isArray(item.metrics) && item.metrics.length > 0, `${label}: item ${index} metrics required`);
  });
}

function validateLiveEvents(json, label) {
  assert(isString(json.updatedAt), `${label}: updatedAt is required`);
  assert(isString(json.section), `${label}: section is required`);
  assert(Array.isArray(json.items) && json.items.length > 0, `${label}: items must exist`);

  json.items.forEach((item, index) => {
    assert(isString(item.id), `${label}: item ${index} id required`);
    assert(isString(item.slug), `${label}: item ${index} slug required`);
    assert(/^[a-z0-9-]+$/.test(item.slug), `${label}: item ${index} slug invalid`);
    assert(isString(item.title), `${label}: item ${index} title required`);
    assert(
      ["upcoming", "live", "ended", "watch", "monitoring"].includes(item.status),
      `${label}: item ${index} status invalid`,
    );
    assert(["space", "earth"].includes(item.category), `${label}: item ${index} category invalid`);
    assert(isString(item.topic), `${label}: item ${index} topic required`);
    assert(isString(item.startsAt), `${label}: item ${index} startsAt required`);
    assert(isString(item.summary), `${label}: item ${index} summary required`);
    assert(isString(item.sourceName), `${label}: item ${index} sourceName required`);
    assert(isString(item.sourceUrl), `${label}: item ${index} sourceUrl required`);
    assert(isString(item.watchUrl), `${label}: item ${index} watchUrl required`);
    assert(
      ["link", "embed_candidate", "summary"].includes(item.coverageMode),
      `${label}: item ${index} coverageMode invalid`,
    );
    assert(typeof item.safeToPromote === "boolean", `${label}: item ${index} safeToPromote required`);
    assert(isString(item.rightsProfile), `${label}: item ${index} rightsProfile required`);
    assert(isString(item.cadence), `${label}: item ${index} cadence required`);
    assert(isString(item.audienceIntent), `${label}: item ${index} audienceIntent required`);
    assert(isString(item.updatedAt), `${label}: item ${index} updatedAt required`);
  });
}

function validateLiveScoreboard(json, label) {
  assert(isString(json.updatedAt), `${label}: updatedAt is required`);
  assert(isString(json.sourceSnapshot), `${label}: sourceSnapshot is required`);
  assert(Array.isArray(json.items) && json.items.length > 0, `${label}: items must exist`);

  json.items.forEach((item, index) => {
    assert(isString(item.slug), `${label}: item ${index} slug required`);
    assert(isString(item.pagePath), `${label}: item ${index} pagePath required`);
    assert(["space", "earth"].includes(item.category), `${label}: item ${index} category invalid`);
    assert(typeof item.score === "number", `${label}: item ${index} score required`);
    assert(["cold-start", "blended", "observed"].includes(item.scoringMode), `${label}: item ${index} scoringMode invalid`);
    assert(typeof item.coldStartScore === "number", `${label}: item ${index} coldStartScore required`);
    assert(typeof item.heuristicScore === "number", `${label}: item ${index} heuristicScore required`);
    assert(typeof item.observedScore === "number", `${label}: item ${index} observedScore required`);
    assert(typeof item.pageviews === "number", `${label}: item ${index} pageviews required`);
    assert(typeof item.watchClicks === "number", `${label}: item ${index} watchClicks required`);
    assert(typeof item.engagementScore === "number", `${label}: item ${index} engagementScore required`);
    assert(typeof item.searchImpressions === "number", `${label}: item ${index} searchImpressions required`);
    assert(typeof item.searchCtr === "number", `${label}: item ${index} searchCtr required`);
    assert(typeof item.categoryPageviews === "number", `${label}: item ${index} categoryPageviews required`);
    assert(isString(item.sourceStability), `${label}: item ${index} sourceStability required`);
    assert(isString(item.recencyBand), `${label}: item ${index} recencyBand required`);
    assert(
      ["expand", "hold", "prune", "review"].includes(item.recommendation),
      `${label}: item ${index} recommendation invalid`,
    );
    assert(isString(item.notes), `${label}: item ${index} notes required`);
  });
}

function validateTopics(json, label) {
  assert(isString(json.updatedAt), `${label}: updatedAt is required`);
  assert(Array.isArray(json.items) && json.items.length > 0, `${label}: items must exist`);

  json.items.forEach((item, index) => {
    assert(isString(item.slug), `${label}: item ${index} slug required`);
    assert(isString(item.title), `${label}: item ${index} title required`);
    assert(["space", "earth"].includes(item.category), `${label}: item ${index} category invalid`);
    assert(isString(item.summary), `${label}: item ${index} summary required`);
    assert(typeof item.eventCount === "number", `${label}: item ${index} eventCount required`);
    assert(typeof item.promotedEventCount === "number", `${label}: item ${index} promotedEventCount required`);
    assert(typeof item.bestScore === "number", `${label}: item ${index} bestScore required`);
    assert(
      ["expand", "hold", "prune", "review"].includes(item.recommendation),
      `${label}: item ${index} recommendation invalid`,
    );
    assert(isString(item.updatedAt), `${label}: item ${index} updatedAt required`);
  });
}

async function main() {
  for (const [relativePath, validator] of files) {
    const absolutePath = new URL(relativePath, root);
    const contents = await readFile(absolutePath, "utf8");
    const json = JSON.parse(contents);
    validator(json, relativePath);
    console.log(`validated ${path.posix.join("public/content", relativePath)}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
