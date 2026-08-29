import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseRssFeed, verifyArticleImages } from "./rss-fetcher.mjs";

const fixtureUrl = new URL("./fixtures/rss-image-cases.xml", import.meta.url);
const feed = { source: "Fixture Publisher", defaultTag: "Technology" };

test("RSS image parser supports the allowed syndication mechanisms deterministically", async () => {
  const articles = await parseFixture();
  const byTitle = new Map(articles.map((article) => [article.title, article]));

  assert.equal(articles.length, 12);
  assert.equal(
    byTitle.get("Media content story").image,
    "https://images.example.com/lead.jpg?width=1200",
  );
  assert.equal(byTitle.get("Media content story").imageAlt, "People watch the night sky");
  assert.equal(byTitle.get("Media content story").imageCredit, "Example Photo Desk");
  assert.equal(byTitle.get("Media content story").imageOrigin, "rss");
  assert.equal(
    byTitle.get("Media content story").imageSourceUrl,
    "https://example.com/media-content",
  );
  assert.equal(
    byTitle.get("Media thumbnail story").image,
    "https://images.example.com/thumb.webp",
  );
  assert.equal(
    byTitle.get("Image enclosure story").image,
    "https://images.example.com/enclosed.png",
  );
  assert.equal(
    byTitle.get("Atom enclosure story").image,
    "https://images.example.com/atom.avif",
  );
  assert.equal(
    byTitle.get("Explicit image structure story").image,
    "https://images.example.com/explicit.gif",
  );
  assert.equal(
    byTitle.get("Preferred image story").image,
    "https://images.example.com/preferred.jpg",
  );
  assert.equal(byTitle.get("Preferred image story").imageCredit, undefined);
});

test("RSS image parser rejects video, documents, invalid URLs, tiny media, and identifiers", async () => {
  const articles = await parseFixture();
  const byTitle = new Map(articles.map((article) => [article.title, article]));

  for (const title of [
    "Video media story",
    "PDF enclosure story",
    "Invalid image story",
    "Tiny image story",
    "Identifier image story",
  ]) {
    assert.equal(byTitle.get(title).image, undefined, title);
  }
});

test("RSS image parsing preserves existing article normalization when no image exists", async () => {
  const articles = await parseFixture();
  const article = articles.find((item) => item.title === "No image story");

  assert.deepEqual(article, {
    source: "Fixture Publisher",
    tag: "Football",
    title: "No image story",
    excerpt: "Existing excerpt behavior remains.",
    url: "https://example.com/no-image",
    publishedAt: "2026-08-28T01:00:00.000Z",
  });
});

test("selected-image verification retains stories and removes only unusable media", async () => {
  const requests = [];
  const input = [
    articleWithImage("usable", "https://images.example.com/usable.jpg"),
    articleWithImage("duplicate-type", "https://images.example.com/duplicate-type.webp"),
    articleWithImage("wrong-type", "https://images.example.com/wrong-type.jpg"),
    articleWithImage("too-small", "https://images.example.com/too-small.jpg"),
    { ...articleWithImage("none", "https://images.example.com/unused.jpg"), image: undefined },
  ];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });

    if (url.includes("duplicate-type")) {
      return response(200, "application/octet-stream, image/webp", "2048");
    }
    if (url.includes("wrong-type")) {
      return response(200, "text/html", "2048");
    }
    if (url.includes("too-small")) {
      return response(200, "image/jpeg", "120");
    }
    return response(206, "image/jpeg", "4096");
  };

  const result = await verifyArticleImages(input, { fetchImpl, timeoutMs: 100 });

  assert.equal(result.articles.length, 5);
  assert.equal(result.articles[0].image, "https://images.example.com/usable.jpg");
  assert.equal(result.articles[1].image, "https://images.example.com/duplicate-type.webp");
  assert.equal(result.articles[2].image, undefined);
  assert.equal(result.articles[3].image, undefined);
  assert.equal(result.articles[4].image, undefined);
  assert.deepEqual(result.diagnostics.map((item) => item.status), [
    "usable",
    "usable",
    "rejected",
    "rejected",
    "not-supplied",
  ]);
  assert.equal(requests.length, 4);
  assert.equal(requests[0].options.headers.range, "bytes=0-4095");
  assert.equal(requests[0].options.redirect, "follow");
});

async function parseFixture() {
  return parseRssFeed(await readFile(fixtureUrl, "utf8"), feed);
}

function articleWithImage(title, image) {
  return {
    source: "Fixture Publisher",
    tag: "World",
    title,
    excerpt: "Fixture summary.",
    url: `https://example.com/${title}`,
    publishedAt: "2026-08-28T00:00:00.000Z",
    image,
    imageAlt: "Fixture image",
    imageCredit: "Fixture credit",
    imageOrigin: "rss",
    imageSourceUrl: `https://example.com/${title}`,
  };
}

function response(status, contentType, contentLength) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({
      "content-length": contentLength,
      "content-type": contentType,
    }),
    body: { cancel: async () => {} },
  };
}
