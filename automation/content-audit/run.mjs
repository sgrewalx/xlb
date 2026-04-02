import { readdir } from "node:fs/promises";
import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";

const EVENTS_FILE = new URL("../../public/content/live/events.json", import.meta.url);
const TOPICS_FILE = new URL("../../public/content/topics/index.json", import.meta.url);
const SCOREBOARD_FILE = new URL("../../public/content/live/scoreboard.json", import.meta.url);
const HEALTH_FILE = new URL("../../automation/reports/live-source-health.json", import.meta.url);
const REPORT_FILE = new URL("../../automation/reports/content-audit.json", import.meta.url);
const QUEUE_FILE = new URL("../../automation/experiments/improvement-queue.json", import.meta.url);

async function main() {
  const [eventsFeed, topicsFeed, scoreboard, health, snapshot] = await Promise.all([
    readJsonIfExists(EVENTS_FILE),
    readJsonIfExists(TOPICS_FILE),
    readJsonIfExists(SCOREBOARD_FILE),
    readJsonIfExists(HEALTH_FILE),
    readLatestMergedSnapshot(),
  ]);

  const events = eventsFeed?.items ?? [];
  const topics = topicsFeed?.items ?? [];
  const scoreItems = scoreboard?.items ?? [];

  if (!events.length || !topics.length || !scoreItems.length) {
    throw new Error("Live content audit requires events, topics, and scoreboard data");
  }

  const updatedAt = new Date().toISOString();
  const audit = buildContentAudit({
    events,
    topics,
    scoreItems,
    health,
    snapshot,
    updatedAt,
  });
  const queue = buildImprovementQueue(audit, updatedAt);

  const reportChanged = await writeJsonIfChanged(REPORT_FILE, audit);
  const queueChanged = await writeJsonIfChanged(QUEUE_FILE, queue);

  console.log(
    reportChanged
      ? "Updated automation/reports/content-audit.json"
      : "automation/reports/content-audit.json already matched generated output",
  );
  console.log(
    queueChanged
      ? "Updated automation/experiments/improvement-queue.json"
      : "automation/experiments/improvement-queue.json already matched generated output",
  );
}

export function buildContentAudit({ events, topics, scoreItems, health, snapshot, updatedAt }) {
  const findings = [];
  const scoreMap = new Map(scoreItems.map((item) => [item.slug, item]));
  const topicMap = new Map(topics.map((item) => [item.slug, item]));
  const latestPages = Array.isArray(snapshot?.pages) ? snapshot.pages : [];

  for (const topic of topics) {
    if (topic.summary.startsWith("Automation monitors")) {
      findings.push({
        id: `generic-summary-${topic.slug}`,
        type: "generic_topic_summary",
        risk: "low",
        autofixEligible: true,
        targetPaths: [`/topics/${topic.slug}`, "/public/content/topics/index.json"],
        summary: `${topic.title} still uses generic automation copy and should be rewritten into audience-facing topic language.`,
      });
    }

    if (topic.slug === "nasa" && topic.title !== "NASA") {
      findings.push({
        id: "nasa-title-normalization",
        type: "normalize_topic_title",
        risk: "low",
        autofixEligible: true,
        targetPaths: ["/topics/nasa", "/public/content/topics/index.json"],
        summary: "The NASA topic title should stay acronym-correct across generated content.",
      });
    }
  }

  for (const event of events) {
    const score = scoreMap.get(event.slug);
    const page = latestPages.find((item) => item.path === `/events/${event.slug}`);
    const pageviews = page?.pageviews ?? score?.pageviews ?? 0;
    const impressions = page?.searchImpressions ?? score?.searchImpressions ?? 0;

    if (score?.recommendation === "review" && pageviews === 0 && impressions === 0) {
      findings.push({
        id: `supporting-context-${event.slug}`,
        type: "strengthen_supporting_context",
        risk: "medium",
        autofixEligible: false,
        targetPaths: [`/events/${event.slug}`, `/topics/${event.topic}`],
        summary: `${event.title} is still in review with no real views or impressions, so it needs stronger supporting context before expansion.`,
      });
    }
  }

  const unstableSources = (health?.sources ?? []).filter((source) => !source.stable);
  for (const source of unstableSources) {
    findings.push({
      id: `source-stability-${source.id}`,
      type: "source_stability_watch",
      risk: "medium",
      autofixEligible: false,
      targetPaths: ["/automation/reports/live-source-health.json"],
      summary: `${source.id} is still earning trust, so dependent pages should stay supervised until the healthy streak improves.`,
    });
  }

  return {
    updatedAt,
    summary: {
      auditedEventCount: events.length,
      auditedTopicCount: topics.length,
      findingCount: findings.length,
      lowRiskAutofixableCount: findings.filter((item) => item.risk === "low" && item.autofixEligible).length,
      mediumRiskQueueCount: findings.filter((item) => item.risk === "medium").length,
      snapshotPageCount: latestPages.length,
    },
    findings,
  };
}

export function buildImprovementQueue(audit, updatedAt) {
  const items = audit.findings.map((finding) => {
    const slug = finding.id.replace(/[^a-z0-9-]/g, "-");

    return {
      id: `imp-${slug}`,
      title: toQueueTitle(finding),
      ownerAgent: finding.autofixEligible ? "autofix-agent" : "improvement-agent",
      risk: finding.risk,
      status: finding.autofixEligible ? "running" : "queued",
      hypothesis: finding.summary,
      targetPaths: finding.targetPaths,
      successMetric:
        finding.risk === "low"
          ? "Generated copy and structure become clearer without changing core product behavior."
          : "The page earns first impressions, clicks, or stronger downstream engagement after supporting context is improved.",
      rollbackPlan:
        finding.risk === "low"
          ? "Regenerate the affected manifest from source if the low-risk copy change is not helpful."
          : "Keep the page in review and avoid further promotion if the supporting-context experiment stays weak.",
      notes: finding.autofixEligible
        ? "Low-risk fix can be applied automatically during the audit loop."
        : "Leave queued for supervised follow-up until real traffic data is available.",
    };
  });

  return {
    updatedAt,
    items,
  };
}

function toQueueTitle(finding) {
  if (finding.type === "generic_topic_summary") {
    return `Rewrite generic topic summary for ${lastTargetSegment(finding.targetPaths[0])}`;
  }

  if (finding.type === "normalize_topic_title") {
    return "Normalize NASA topic title casing";
  }

  if (finding.type === "strengthen_supporting_context") {
    return `Strengthen supporting context for ${lastTargetSegment(finding.targetPaths[0])}`;
  }

  if (finding.type === "source_stability_watch") {
    return `Keep ${finding.id.replace("source-stability-", "")} under supervised watch`;
  }

  return "Follow up on content audit finding";
}

function lastTargetSegment(value = "") {
  return value.split("/").filter(Boolean).at(-1) ?? value;
}

async function readLatestMergedSnapshot() {
  const snapshotDirectory = new URL("../../automation/snapshots/", import.meta.url);
  const filenames = await readdir(snapshotDirectory);
  const latestMerged = filenames
    .filter((filename) => filename.startsWith("merged-") && filename.endsWith(".json"))
    .sort()
    .at(-1);

  if (!latestMerged) {
    return null;
  }

  return readJsonIfExists(new URL(`../../automation/snapshots/${latestMerged}`, import.meta.url));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
