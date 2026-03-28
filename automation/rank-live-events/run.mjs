import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const EVENTS_FILE = new URL("../../public/content/live/events.json", import.meta.url);
const SCOREBOARD_FILE = new URL("../../public/content/live/scoreboard.json", import.meta.url);
const HEALTH_FILE = new URL("../../automation/reports/live-source-health.json", import.meta.url);
const SNAPSHOT_FILE = process.env.XLB_ANALYTICS_SNAPSHOT
  ? new URL(process.env.XLB_ANALYTICS_SNAPSHOT, `file://${process.cwd()}/`)
  : new URL("../snapshots/merged-2026-03-27.json", import.meta.url);

async function main() {
  const events = await readJsonIfExists(EVENTS_FILE);
  const health = await readJsonIfExists(HEALTH_FILE);
  const snapshot = await readJsonIfExists(SNAPSHOT_FILE);

  if (!events?.items?.length) {
    throw new Error("Live events manifest is missing or empty");
  }

  if (!snapshot?.pages?.length) {
    throw new Error("Analytics snapshot is missing or empty");
  }

  const analyticsContext = summarizeAnalyticsContext(snapshot.pages);
  const sourceHealthMap = new Map((health?.sources ?? []).map((source) => [source.id, source]));

  const items = events.items.map((event) => {
    const pagePath = `/events/${event.slug}`;
    const metrics = snapshot.pages.find((page) => page.path === pagePath) ?? null;
    const categoryPath = `/live/${event.category}`;
    const categoryMetrics = snapshot.pages.find((page) => page.path === categoryPath) ?? null;

    const pageviews = metrics?.pageviews ?? 0;
    const watchClicks = metrics?.watchClicks ?? 0;
    const engagementScore = metrics?.engagementScore ?? 0;
    const searchImpressions = metrics?.searchImpressions ?? 0;
    const searchCtr = metrics?.searchCtr ?? 0;
    const heuristic = buildHeuristicAssessment(event, sourceHealthMap.get(resolveSourceId(event)));
    const observedScore = Math.round(
      pageviews * 0.3 +
        watchClicks * 1.6 +
        engagementScore * 1.2 +
        searchImpressions * 0.04 +
        searchCtr * 180,
    );
    const coldStart = buildColdStartAssessment(event);
    const adjustedColdStartScore = Math.round(coldStart.score * 0.75 + heuristic.score * 0.25);
    const score = blendScores({
      coldStartScore: adjustedColdStartScore,
      observedScore,
      analyticsContext,
    });
    const recommendation = getRecommendation({
      event,
      score,
      coldStartScore: adjustedColdStartScore,
      observedScore,
      heuristicScore: heuristic.score,
      pageviews,
      watchClicks,
      engagementScore,
      analyticsContext,
    });

    return {
      slug: event.slug,
      pagePath,
      category: event.category,
      score,
      scoringMode: analyticsContext.mode,
      coldStartScore: adjustedColdStartScore,
      heuristicScore: heuristic.score,
      observedScore,
      pageviews,
      watchClicks,
      engagementScore,
      searchImpressions,
      searchCtr,
      categoryPageviews: categoryMetrics?.pageviews ?? 0,
      sourceStability: heuristic.sourceStability,
      recencyBand: heuristic.recencyBand,
      recommendation,
      notes: buildNotes({
        metrics,
        event,
        analyticsContext,
        coldStartReasons: coldStart.reasons,
        heuristicReasons: heuristic.reasons,
      }),
    };
  });

  items.sort((left, right) => right.score - left.score);

  const changed = await writeJsonIfChanged(SCOREBOARD_FILE, {
    updatedAt: new Date().toISOString(),
    sourceSnapshot: snapshot.capturedAt,
    items,
  });

  console.log(
    changed
      ? "Updated public/content/live/scoreboard.json"
      : "public/content/live/scoreboard.json already matched ranked output",
  );
}

function buildColdStartAssessment(event) {
  let score = 0;
  const reasons = [];

  score += Math.round((event.heroPriority ?? 0) * 0.55);
  reasons.push(`priority ${event.heroPriority ?? 0}`);

  const rightsScore =
    event.rightsProfile === "public-information"
      ? 18
      : event.rightsProfile === "internal-placeholder"
        ? -16
        : 0;
  score += rightsScore;
  reasons.push(`rights ${event.rightsProfile}`);

  const cadenceScore =
    event.cadence === "continuous"
      ? 16
      : event.cadence === "recurring"
        ? 14
        : event.cadence === "scheduled"
          ? 10
          : 0;
  score += cadenceScore;
  reasons.push(`cadence ${event.cadence}`);

  const intentScore =
    event.audienceIntent === "watch-live"
      ? 16
      : event.audienceIntent === "monitor-live"
        ? 15
        : event.audienceIntent === "track-schedule"
          ? 10
          : 0;
  score += intentScore;
  reasons.push(`intent ${event.audienceIntent}`);

  const statusScore =
    event.status === "live"
      ? 18
      : event.status === "watch"
        ? 15
        : event.status === "monitoring"
          ? 14
          : event.status === "upcoming"
            ? 8
            : -10;
  score += statusScore;
  reasons.push(`status ${event.status}`);

  const coverageScore =
    event.coverageMode === "link"
      ? 10
      : event.coverageMode === "summary"
        ? -4
        : 5;
  score += coverageScore;
  reasons.push(`coverage ${event.coverageMode}`);

  if (event.safeToPromote) {
    score += 8;
    reasons.push("safe to promote");
  } else {
    score -= 10;
    reasons.push("promotion blocked");
  }

  return {
    score: Math.max(Math.min(score, 100), 0),
    reasons,
  };
}

function buildHeuristicAssessment(event, sourceHealth) {
  let score = 45;
  const reasons = [];
  const now = Date.now();
  const startsAt = Date.parse(event.startsAt);
  const timeUntilStart = Number.isFinite(startsAt) ? startsAt - now : Number.NaN;

  let recencyBand = "timeless";
  if (event.status === "monitoring" || event.cadence === "continuous") {
    score += 18;
    recencyBand = "continuous";
    reasons.push("continuous monitoring");
  } else if (event.status === "watch" && event.cadence === "recurring") {
    score += 14;
    recencyBand = "recurring";
    reasons.push("recurring watch surface");
  } else if (Number.isFinite(timeUntilStart) && timeUntilStart >= 0 && timeUntilStart <= 7 * 24 * 60 * 60 * 1000) {
    score += 18;
    recencyBand = "next-7-days";
    reasons.push("starts within 7 days");
  } else if (
    Number.isFinite(timeUntilStart) &&
    timeUntilStart > 7 * 24 * 60 * 60 * 1000 &&
    timeUntilStart <= 30 * 24 * 60 * 60 * 1000
  ) {
    score += 12;
    recencyBand = "next-30-days";
    reasons.push("starts within 30 days");
  } else if (Number.isFinite(timeUntilStart) && timeUntilStart < 0) {
    score -= 22;
    recencyBand = "stale";
    reasons.push("stale event timing");
  } else {
    score += 6;
    reasons.push("long-tail timing");
  }

  let sourceStability = "unknown";
  if (sourceHealth?.status === "healthy" && sourceHealth?.stable) {
    score += 18;
    sourceStability = "stable";
    reasons.push("source stable");
  } else if (sourceHealth?.status === "healthy") {
    score += 8;
    sourceStability = "earning-trust";
    reasons.push("source healthy but earning trust");
  } else if (sourceHealth?.status === "degraded") {
    score -= 24;
    sourceStability = "degraded";
    reasons.push("source degraded");
  }

  if (event.audienceIntent === "monitor-live" && event.category === "earth") {
    score += 6;
    reasons.push("repeat-check earth signal");
  }

  if (event.topic === "space-weather") {
    score += 4;
    reasons.push("space-weather diversification");
  }

  return {
    score: Math.max(Math.min(score, 100), 0),
    sourceStability,
    recencyBand,
    reasons,
  };
}

function summarizeAnalyticsContext(pages) {
  if (process.env.XLB_FORCE_COLD_START === "1") {
    return { mode: "cold-start", blendObservedWeight: 0 };
  }

  const eventPages = pages.filter((page) => page.path.startsWith("/events/"));
  const totalEventPageviews = eventPages.reduce((total, page) => total + (page.pageviews ?? 0), 0);
  const totalSearchImpressions = eventPages.reduce(
    (total, page) => total + (page.searchImpressions ?? 0),
    0,
  );

  if (totalEventPageviews < 150 && totalSearchImpressions < 300) {
    return { mode: "cold-start", blendObservedWeight: 0.15 };
  }

  if (totalEventPageviews < 500) {
    return { mode: "blended", blendObservedWeight: 0.45 };
  }

  return { mode: "observed", blendObservedWeight: 0.8 };
}

function blendScores({ coldStartScore, observedScore, analyticsContext }) {
  const observedWeight = analyticsContext.blendObservedWeight;
  const coldWeight = 1 - observedWeight;
  return Math.round(coldStartScore * coldWeight + observedScore * observedWeight);
}

function getRecommendation({
  event,
  score,
  coldStartScore,
  observedScore,
  heuristicScore,
  pageviews,
  watchClicks,
  engagementScore,
  analyticsContext,
}) {
  if (analyticsContext.mode === "cold-start") {
    if (!event.safeToPromote && coldStartScore < 55) {
      return "prune";
    }

    if (coldStartScore >= 75 && heuristicScore >= 65) {
      return "expand";
    }

    if (coldStartScore >= 55 || heuristicScore >= 50) {
      return "hold";
    }

    return "review";
  }

  if (engagementScore >= 75 || watchClicks >= 25) {
    return "expand";
  }

  if (!event.safeToPromote && pageviews < 60) {
    return "prune";
  }

  if (pageviews >= 60 || engagementScore >= 50) {
    return "hold";
  }

  return "review";
}

function buildNotes({ metrics, event, analyticsContext, coldStartReasons, heuristicReasons }) {
  const baseNote =
    metrics?.notes ??
    (event.safeToPromote
      ? "Promoted event without a dedicated analytics note yet."
      : "Seed event pending stronger signal collection.");

  return `${analyticsContext.mode} scoring active; ${coldStartReasons.join(", ")}; heuristics ${heuristicReasons.join(", ")}. ${baseNote}`;
}

function resolveSourceId(event) {
  if (event.topic === "launches") {
    return "nasa-launch-schedule";
  }
  if (event.topic === "earthquakes") {
    return "usgs-earthquakes";
  }
  if (event.topic === "space-weather") {
    return "noaa-space-weather";
  }
  return "";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
