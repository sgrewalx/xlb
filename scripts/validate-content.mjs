import { readFile } from "node:fs/promises";
import path from "node:path";

const root = new URL("../public/content/", import.meta.url);

const files = [
  ["news/top3.json", validateTopFeed],
  ["sports/top3.json", validateTopFeed],
  ["quotes/quotes.json", validateQuotes],
  ["visuals/feed.json", validateVisuals],
  ["modules/modules.json", validateModules],
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
