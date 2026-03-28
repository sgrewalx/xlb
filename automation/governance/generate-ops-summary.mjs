import { appendFile, readFile } from "node:fs/promises";

const HEALTH_FILE = new URL("../../automation/reports/live-source-health.json", import.meta.url);
const RISK_FILE = new URL("../../automation/reports/live-risk-report.json", import.meta.url);
const DEPLOY_FILE = new URL("../../automation/reports/deploy-readiness.json", import.meta.url);
const AUTONOMY_FILE = new URL("../../automation/reports/autonomy-state.json", import.meta.url);
const SCOREBOARD_FILE = new URL("../../public/content/live/scoreboard.json", import.meta.url);

async function readJson(url) {
  const raw = await readFile(url, "utf8");
  return JSON.parse(raw);
}

function titleCase(value) {
  return String(value ?? "unknown")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function main() {
  const [health, risk, deploy, autonomy, scoreboard] = await Promise.all([
    readJson(HEALTH_FILE),
    readJson(RISK_FILE),
    readJson(DEPLOY_FILE),
    readJson(AUTONOMY_FILE),
    readJson(SCOREBOARD_FILE),
  ]);

  const topItems = Array.isArray(scoreboard.items) ? scoreboard.items.slice(0, 5) : [];
  const sources = Array.isArray(health.sources) ? health.sources : [];
  const reasons = Array.isArray(risk.reasons) ? risk.reasons : [];

  const markdown = [
    "## XLB Ops Summary",
    "",
    `- Deploy: **${titleCase(deploy.status)}**`,
    `- Risk: **${titleCase(risk.level)}**`,
    `- Autonomy: **${titleCase(autonomy.status)}**`,
    `- Source health: **${titleCase(health.status)}**`,
    `- Source stability: **${titleCase(health.stability?.status)}**`,
    `- Analytics coverage: **${Math.round(Number(risk.analyticsSignals?.eventCoverageRatio ?? 0) * 100)}%**`,
    "",
    "### Current Blockers",
    ...reasons.map((reason) => `- ${reason}`),
    "",
    "### Source Status",
    ...sources.map(
      (source) =>
        `- ${titleCase(source.id)}: ${titleCase(source.status)} | stable: ${source.stable ? "yes" : "no"} | healthy streak: ${source.healthyStreak ?? 0}`,
    ),
    "",
    "### Top Event Decisions",
    ...topItems.map(
      (item) =>
        `- ${item.slug}: ${titleCase(item.recommendation)} | score ${item.score ?? 0} | pageviews ${item.pageviews ?? 0}`,
    ),
    "",
  ].join("\n");

  console.log(markdown);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
