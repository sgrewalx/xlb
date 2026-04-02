import { readJsonIfExists, writeJsonIfChanged } from "../shared/content-writer.mjs";
import { formatTopicTitle, summarizeTopic } from "../shared/live-topic-copy.mjs";

const TOPICS_FILE = new URL("../../public/content/topics/index.json", import.meta.url);
const EVENTS_FILE = new URL("../../public/content/live/events.json", import.meta.url);
const SCOREBOARD_FILE = new URL("../../public/content/live/scoreboard.json", import.meta.url);
const OUTPUT_FILE = new URL("../../automation/reports/low-risk-autofix.json", import.meta.url);

async function main() {
  const [topicsFeed, eventsFeed, scoreboard] = await Promise.all([
    readJsonIfExists(TOPICS_FILE),
    readJsonIfExists(EVENTS_FILE),
    readJsonIfExists(SCOREBOARD_FILE),
  ]);

  const topics = topicsFeed?.items ?? [];
  const events = eventsFeed?.items ?? [];
  const scoreMap = new Map((scoreboard?.items ?? []).map((item) => [item.slug, item]));

  if (!topics.length || !events.length) {
    throw new Error("Low-risk autofixes require topics and events data");
  }

  let appliedCount = 0;
  const changes = [];
  const updatedAt = new Date().toISOString();

  const nextTopics = topics.map((topic) => {
    const topicEvents = events.filter((event) => event.topic === topic.slug);
    const nextTitle = formatTopicTitle(topic.slug);
    const nextSummary = summarizeTopic(topicEvents, scoreMap);
    const changed = nextTitle !== topic.title || nextSummary !== topic.summary;

    if (changed) {
      appliedCount += 1;
      changes.push({
        slug: topic.slug,
        updates: [
          nextTitle !== topic.title ? "title" : null,
          nextSummary !== topic.summary ? "summary" : null,
        ].filter(Boolean),
      });
    }

    return {
      ...topic,
      title: nextTitle,
      summary: nextSummary,
      updatedAt,
    };
  });

  const topicsChanged = await writeJsonIfChanged(TOPICS_FILE, {
    updatedAt,
    items: nextTopics,
  });

  const reportChanged = await writeJsonIfChanged(OUTPUT_FILE, {
    updatedAt,
    appliedCount,
    changes,
  });

  console.log(
    topicsChanged
      ? "Updated public/content/topics/index.json with low-risk autofixes"
      : "No low-risk autofixes were needed in public/content/topics/index.json",
  );
  console.log(
    reportChanged
      ? "Updated automation/reports/low-risk-autofix.json"
      : "automation/reports/low-risk-autofix.json already matched generated output",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
