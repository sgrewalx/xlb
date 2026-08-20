import test from "node:test";
import assert from "node:assert/strict";
import { buildRankedScoreboard } from "../rank-live-events/run.mjs";
import { buildRouteDefinitions } from "../../scripts/route-definitions.mjs";
import { validateRouteConsistency } from "../../scripts/validate-routes.mjs";
import { candidateSteps, runCandidatePipeline } from "./run-content-candidate.mjs";

const previousEvent = makeEvent({
  slug: "roscosmos-progress-96",
  title: "Roscosmos Progress 96",
});
const refreshedEvent = makeEvent({
  slug: "new-source-launch",
  title: "New source launch",
});

test("candidate dependency order refreshes and checks health before one rank pass", () => {
  assert.deepEqual(candidateSteps.map((step) => step.id), [
    "traffic-opportunities",
    "live-events",
    "source-health",
    "rank-live",
    "low-risk-autofixes",
    "surface-manifests",
    "apply-opportunities",
    "sitemap",
    "content-audit",
    "live-risk",
    "deploy-readiness",
    "ops-summary",
  ]);
  assert.equal(candidateSteps.filter((step) => step.id === "source-health").length, 1);
});

test("removed refreshed event cannot remain orphaned in the final scoreboard", async () => {
  const result = await runRefreshAndRankScenario();

  assert.equal(result.initialScoreboard.items[0].slug, "roscosmos-progress-96");
  assert.equal(result.scoreboard.items.some((item) => item.slug === "roscosmos-progress-96"), false);
  assert.doesNotThrow(result.validateRoutes);
});

test("newly refreshed event is ranked during the same candidate run", async () => {
  const result = await runRefreshAndRankScenario();

  assert.equal(result.events.items.some((item) => item.slug === "new-source-launch"), true);
  assert.equal(result.scoreboard.items.some((item) => item.slug === "new-source-launch"), true);
  assert.doesNotThrow(result.validateRoutes);
});

async function runRefreshAndRankScenario() {
  const initialScoreboard = {
    updatedAt: "2026-08-19T00:00:00.000Z",
    sourceSnapshot: "2026-08-19T00:00:00.000Z",
    items: [{ slug: previousEvent.slug, pagePath: `/events/${previousEvent.slug}` }],
  };
  const state = {
    events: { updatedAt: "2026-08-19T00:00:00.000Z", items: [previousEvent] },
    scoreboard: structuredClone(initialScoreboard),
    health: null,
  };
  const snapshot = {
    capturedAt: "2026-08-20T00:00:00.000Z",
    pages: [
      { path: "/", pageviews: 1 },
      { path: `/events/${previousEvent.slug}`, pageviews: 20 },
      { path: `/events/${refreshedEvent.slug}`, pageviews: 2 },
    ],
  };

  await runCandidatePipeline({
    steps: candidateSteps,
    runStep: async (step) => {
      if (step.id === "live-events") {
        state.events = {
          updatedAt: "2026-08-20T00:01:00.000Z",
          items: [refreshedEvent],
        };
      }
      if (step.id === "source-health") {
        state.health = {
          status: "healthy",
          sources: [{ id: "nasa-launch-schedule", status: "healthy", stable: true }],
        };
      }
      if (step.id === "rank-live") {
        state.scoreboard = {
          updatedAt: "2026-08-20T00:02:00.000Z",
          sourceSnapshot: snapshot.capturedAt,
          items: buildRankedScoreboard({
            events: state.events.items,
            health: state.health,
            snapshot,
            now: Date.parse("2026-08-20T00:00:00.000Z"),
          }),
        };
      }
    },
    validateAndBuild: async () => {},
  });

  const topics = {
    updatedAt: "2026-08-20T00:01:00.000Z",
    items: [{
      slug: "launches",
      title: "Launches",
      category: "space",
      summary: "Current source-backed launches.",
      updatedAt: "2026-08-20T00:01:00.000Z",
    }],
  };
  const routes = buildRouteDefinitions({ eventsFeed: state.events, topicsFeed: topics });
  const manifests = [
    { relativePath: "live/events.json", value: state.events },
    { relativePath: "live/scoreboard.json", value: state.scoreboard },
    { relativePath: "topics/index.json", value: topics },
  ];

  return {
    initialScoreboard,
    events: state.events,
    scoreboard: state.scoreboard,
    validateRoutes: () => validateRouteConsistency({
      routes,
      sitemapRoutes: routes.map((route) => route.path),
      manifests,
      eventsFeed: state.events,
      topicsFeed: topics,
    }),
  };
}

function makeEvent({ slug, title }) {
  return {
    slug,
    title,
    summary: `${title} source-backed schedule.`,
    status: "upcoming",
    category: "space",
    topic: "launches",
    startsAt: "2026-08-21T00:00:00.000Z",
    sourceName: "NASA",
    rightsProfile: "public-information",
    cadence: "scheduled",
    audienceIntent: "track-schedule",
    coverageMode: "link",
    safeToPromote: true,
    heroPriority: 80,
    updatedAt: "2026-08-20T00:01:00.000Z",
  };
}
