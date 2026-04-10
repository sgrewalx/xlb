import { readFile, readdir } from "node:fs/promises";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const SNAPSHOT_FILE = process.env.XLB_ANALYTICS_SNAPSHOT
  ? new URL(process.env.XLB_ANALYTICS_SNAPSHOT, `file://${process.cwd()}/`)
  : null;
const SNAPSHOT_DIRECTORY = new URL("../snapshots/", import.meta.url);
const SITEMAP_FILE = new URL("../../public/sitemap.xml", import.meta.url);
const REPORT_FILE = new URL("../reports/traffic-opportunities.json", import.meta.url);
const QUEUE_FILE = new URL("../experiments/traffic-opportunities.json", import.meta.url);

async function main() {
  const snapshot = await readJsonIfExists(SNAPSHOT_FILE ?? await latestMergedSnapshotUrl());

  if (!snapshot?.pages?.length) {
    throw new Error("Traffic opportunity generation requires a non-empty analytics snapshot.");
  }

  const sitemapPaths = await readSitemapPaths();
  const updatedAt = new Date().toISOString();
  const inputQuality = assessInputQuality(snapshot);
  const opportunities = buildOpportunities({ snapshot, sitemapPaths, inputQuality });
  const queue = buildQueue({ updatedAt, opportunities, inputQuality });
  const report = {
    updatedAt,
    sourceSnapshot: snapshot.capturedAt,
    inputQuality,
    summary: {
      pageCount: snapshot.pages.length,
      sitemapPathCount: sitemapPaths.length,
      opportunityCount: opportunities.length,
      searchOpportunityCount: opportunities.filter((item) => item.signal.startsWith("search_")).length,
      engagementOpportunityCount: opportunities.filter((item) => item.signal.startsWith("engagement_")).length,
      indexWatchCount: opportunities.filter((item) => item.signal === "index_watch").length,
    },
    opportunities,
  };

  const reportChanged = await writeJsonIfChanged(REPORT_FILE, report);
  const queueChanged = await writeJsonIfChanged(QUEUE_FILE, queue);

  console.log(
    reportChanged
      ? "Updated automation/reports/traffic-opportunities.json"
      : "automation/reports/traffic-opportunities.json already matched generated output",
  );
  console.log(
    queueChanged
      ? "Updated automation/experiments/traffic-opportunities.json"
      : "automation/experiments/traffic-opportunities.json already matched generated output",
  );
}

function buildOpportunities({ snapshot, sitemapPaths, inputQuality }) {
  const pages = snapshot.pages
    .filter((page) => page.path && page.path !== "/404")
    .map((page) => ({
      ...page,
      pageviews: Number(page.pageviews ?? 0),
      visits: Number(page.visits ?? 0),
      searchImpressions: Number(page.searchImpressions ?? 0),
      searchCtr: Number(page.searchCtr ?? 0),
      avgPosition: Number(page.avgPosition ?? 0),
      watchClicks: Number(page.watchClicks ?? 0),
      engagementScore: Number(page.engagementScore ?? 0),
    }));
  const pageMap = new Map(pages.map((page) => [page.path, page]));
  const opportunities = [];

  for (const page of pages) {
    if (page.searchImpressions >= 10 && page.searchCtr < 0.03) {
      opportunities.push(toOpportunity({
        page,
        signal: "search_ctr_lift",
        score: Math.round(page.searchImpressions * (0.03 - page.searchCtr) * 100),
        title: `Improve search snippet for ${page.path}`,
        hypothesis: `${page.path} is earning impressions but has weak CTR, so title/meta copy and internal context should be tested.`,
        successMetric: "Search CTR improves over the next 28-day Search Console window.",
        recommendation: "Review title, meta description, first-screen copy, and internal anchor text.",
        inputQuality,
      }));
    }

    if (page.searchImpressions >= 5 && page.avgPosition > 8 && page.avgPosition <= 30) {
      opportunities.push(toOpportunity({
        page,
        signal: "search_striking_distance",
        score: Math.round(page.searchImpressions / Math.max(page.avgPosition, 1)),
        title: `Strengthen ranking support for ${page.path}`,
        hypothesis: `${page.path} is close enough in search results that better supporting copy and internal links may improve rank.`,
        successMetric: "Average Search Console position improves while impressions are maintained or increase.",
        recommendation: "Add clearer on-page context and link to it from the most relevant section page.",
        inputQuality,
      }));
    }

    if (page.pageviews >= 10 && page.engagementScore >= 70) {
      opportunities.push(toOpportunity({
        page,
        signal: "engagement_expand",
        score: Math.round(page.pageviews * 0.7 + page.engagementScore),
        title: `Expand high-engagement path ${page.path}`,
        hypothesis: `${page.path} shows comparatively strong engagement and should receive more supporting links or adjacent content.`,
        successMetric: "Pageviews and return visits rise without reducing engagement score.",
        recommendation: "Promote the page from adjacent sections and add one related follow-up surface.",
        inputQuality,
      }));
    }

    if (page.path.startsWith("/events/") && page.pageviews >= 10 && page.watchClicks / page.pageviews < 0.08) {
      opportunities.push(toOpportunity({
        page,
        signal: "engagement_watch_click_lift",
        score: Math.round(page.pageviews * 0.4),
        title: `Improve source-click path for ${page.path}`,
        hypothesis: `${page.path} receives visits but few source/watch clicks, so the call-to-action may need clearer framing.`,
        successMetric: "Watch/source click rate improves over the next analytics window.",
        recommendation: "Clarify the primary source action and move supporting context closer to the CTA.",
        inputQuality,
      }));
    }
  }

  for (const path of sitemapPaths) {
    if (!pageMap.has(path) && isGrowthPath(path)) {
      opportunities.push({
        id: `traffic-index-watch-${slugify(path)}`,
        path,
        signal: "index_watch",
        score: 8,
        risk: "low",
        title: `Watch index coverage for ${path}`,
        hypothesis: `${path} is in the sitemap but has not appeared in the current analytics snapshot.`,
        successMetric: "The path receives first impressions or visits in a future analytics window.",
        recommendation: "Keep the page linked and avoid expanding it until first real signals arrive.",
        metrics: {
          pageviews: 0,
          visits: 0,
          searchImpressions: 0,
          searchCtr: 0,
          avgPosition: 0,
          watchClicks: 0,
          engagementScore: 0,
        },
        inputQuality,
      });
    }
  }

  return opportunities
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}

function toOpportunity({
  page,
  signal,
  score,
  title,
  hypothesis,
  successMetric,
  recommendation,
  inputQuality,
}) {
  return {
    id: `traffic-${signal}-${slugify(page.path)}`,
    path: page.path,
    signal,
    score,
    risk: inputQuality.quality === "live-api" ? "medium" : "low",
    title,
    hypothesis,
    successMetric,
    recommendation,
    metrics: {
      pageviews: page.pageviews,
      visits: page.visits,
      searchImpressions: page.searchImpressions,
      searchCtr: page.searchCtr,
      avgPosition: page.avgPosition,
      watchClicks: page.watchClicks,
      engagementScore: page.engagementScore,
    },
    inputQuality,
  };
}

function buildQueue({ updatedAt, opportunities, inputQuality }) {
  const status = inputQuality.quality === "live-api" ? "queued" : "awaiting_review";

  return {
    updatedAt,
    items: opportunities.map((opportunity) => ({
      id: opportunity.id,
      title: opportunity.title,
      ownerAgent: "traffic-improvement-agent",
      risk: opportunity.risk,
      status,
      hypothesis: opportunity.hypothesis,
      targetPaths: [opportunity.path],
      successMetric: opportunity.successMetric,
      rollbackPlan: "Revert the content or internal-link change if the next analytics window shows weaker engagement or CTR.",
      notes: `${opportunity.recommendation} Input quality: ${inputQuality.quality}. ${inputQuality.notes}`,
    })),
  };
}

function assessInputQuality(snapshot) {
  const notes = (snapshot.pages ?? []).map((page) => page.notes ?? "").join(" ");
  const hasLiveGa4 = notes.includes("GA4 Data API");
  const hasLiveSearchConsole = notes.includes("Search Console API");
  const hasFallbackImport = notes.includes("GA4-style export") || notes.includes("Search Console-style export");

  if (hasLiveGa4 || hasLiveSearchConsole) {
    return {
      quality: "live-api",
      hasLiveGa4,
      hasLiveSearchConsole,
      notes: "Snapshot includes live API data and can be used for supervised optimization decisions.",
    };
  }

  if (hasFallbackImport) {
    return {
      quality: "fallback-import",
      hasLiveGa4: false,
      hasLiveSearchConsole: false,
      notes: "Snapshot appears to come from fallback/import data; use it for pipeline testing, not unattended optimization.",
    };
  }

  return {
    quality: "unknown",
    hasLiveGa4: Boolean(snapshot.sources?.ga4),
    hasLiveSearchConsole: Boolean(snapshot.sources?.searchConsole),
    notes: "Snapshot source could not be confidently identified; keep recommendations under review.",
  };
}

async function latestMergedSnapshotUrl() {
  const filenames = await readdir(SNAPSHOT_DIRECTORY);
  const latest = filenames
    .filter((filename) => filename.startsWith("merged-") && filename.endsWith(".json"))
    .sort()
    .at(-1);

  if (!latest) {
    throw new Error("No merged analytics snapshot found.");
  }

  return new URL(`../snapshots/${latest}`, import.meta.url);
}

async function readSitemapPaths() {
  const xml = await readFile(SITEMAP_FILE, "utf8");
  return Array.from(xml.matchAll(/<loc>https:\/\/xlb\.codemachine\.in([^<]+)<\/loc>/g), (match) => {
    try {
      return new URL(match[0].replace(/^<loc>|<\/loc>$/g, "")).pathname;
    } catch {
      return match[1] || "/";
    }
  });
}

function isGrowthPath(path) {
  return (
    path === "/games" ||
    path === "/gallery" ||
    path === "/sports" ||
    path === "/news" ||
    path.startsWith("/events/") ||
    path.startsWith("/topics/")
  );
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "home";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
