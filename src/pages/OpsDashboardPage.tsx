import { useEffect, useState } from "react";
import { Seo } from "../components/Seo";

type GenericRecord = Record<string, any>;
type OpsTab = "progress" | "experiments" | "automation";
type JsonModule = { default: GenericRecord };
type JsonLoader = () => Promise<JsonModule>;
type OpsState = {
  loading: boolean;
  error: string | null;
  reports: Record<string, GenericRecord | null>;
  snapshot: GenericRecord | null;
  scoreboard: GenericRecord | null;
  queue: GenericRecord | null;
  weekly: GenericRecord[];
};

const reportModules = import.meta.glob<JsonModule>("../../automation/reports/*.json") as Record<string, JsonLoader>;
const snapshotModules = import.meta.glob<JsonModule>("../../automation/snapshots/*.json") as Record<string, JsonLoader>;
const experimentModules = import.meta.glob<JsonModule>("../../automation/experiments/*.json") as Record<string, JsonLoader>;
const weeklyModules = import.meta.glob<JsonModule>("../../automation/progress/weekly/*.json") as Record<string, JsonLoader>;

function title(value: unknown) {
  return String(value ?? "unavailable").replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function number(value: unknown) { return typeof value === "number" ? value.toLocaleString("en") : "Unavailable"; }
function percent(value: unknown) { return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "Unavailable"; }
function timestamp(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return "Unavailable";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}
function shortSha(value: unknown) { return typeof value === "string" ? value.slice(0, 8) : "Unavailable"; }
function delta(value: unknown) {
  if (typeof value !== "number") return { label: "Unavailable", className: "ops-delta-neutral" };
  if (value === 0) return { label: "No change", className: "ops-delta-neutral" };
  return { label: `${value > 0 ? "+" : ""}${value.toLocaleString("en")}`, className: value > 0 ? "ops-delta-up" : "ops-delta-down" };
}

async function loadMatching(modules: Record<string, JsonLoader>, suffix: string) {
  const match = Object.entries(modules).find(([path]) => path.endsWith(suffix));
  return match ? (await match[1]()).default : null;
}
async function loadLatestSnapshot() {
  const entry = Object.entries(snapshotModules).filter(([path]) => /\/merged-\d{4}-\d{2}-\d{2}\.json$/.test(path)).sort(([a], [b]) => b.localeCompare(a))[0];
  return entry ? { path: entry[0].split("/").pop(), data: (await entry[1]()).default } : null;
}
async function loadWeekly() {
  return Promise.all(Object.entries(weeklyModules).sort(([a], [b]) => b.localeCompare(a)).map(async ([, loader]) => (await loader()).default));
}

export default function OpsDashboardPage() {
  const [tab, setTab] = useState<OpsTab>("progress");
  const [state, setState] = useState<OpsState>({ loading: true, error: null, reports: {}, snapshot: null, scoreboard: null, queue: null, weekly: [] });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadMatching(reportModules, "live-source-health.json"), loadMatching(reportModules, "live-source-intake.json"),
      loadMatching(reportModules, "live-risk-report.json"), loadMatching(reportModules, "deploy-readiness.json"),
      loadMatching(reportModules, "autonomy-state.json"), loadMatching(reportModules, "content-audit.json"),
      loadMatching(reportModules, "low-risk-autofix.json"), loadMatching(reportModules, "traffic-opportunities.json"),
      loadLatestSnapshot(), loadMatching(experimentModules, "/queue.json"), loadWeekly(),
      fetch("/content/live/scoreboard.json").then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load live scoreboard"))),
    ]).then(([sourceHealth, sourceIntake, liveRisk, deployReadiness, autonomyState, contentAudit, lowRiskFixes, opportunities, snapshot, queue, weekly, scoreboard]) => {
      if (!cancelled) setState({ loading: false, error: null, reports: { sourceHealth, sourceIntake, liveRisk, deployReadiness, autonomyState, contentAudit, lowRiskFixes, opportunities }, snapshot, scoreboard, queue, weekly });
    }).catch((error) => {
      if (!cancelled) setState((current) => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Could not load local ops data" }));
    });
    return () => { cancelled = true; };
  }, []);

  const currentWeek = state.weekly[0];
  return (
    <>
      <Seo title="Ops Dashboard | XLB" description="Local-only experiment, progress, and automation controls." path="/__ops" />
      <section className="ops-page">
        <header className="ops-hero">
          <div className="ops-hero-copy"><p className="section-eyebrow">Local Ops</p><h1>Progress, experiments, and automation.</h1><p>Committed aggregate evidence only. This route is excluded from production builds.</p></div>
          <div className="ops-hero-rail"><div className="ops-pill"><span>Current week</span><strong>{currentWeek?.week ?? "Unavailable"}</strong></div><div className="ops-pill"><span>Active experiments</span><strong>{number(currentWeek?.experiments?.active)}</strong></div></div>
        </header>

        <nav className="ops-tabs" aria-label="Ops dashboard views">
          {(["progress", "experiments", "automation"] as OpsTab[]).map((item) => <button aria-selected={tab === item} className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)} role="tab" type="button">{title(item)}</button>)}
        </nav>

        {state.loading ? <section className="ops-panel"><h2>Loading</h2><p>Reading local control-plane records.</p></section> : null}
        {state.error ? <section className="ops-panel"><h2>Could not load ops data</h2><p>{state.error}</p></section> : null}
        {!state.loading && !state.error && tab === "progress" ? <ProgressView current={currentWeek} previous={state.weekly[1]} /> : null}
        {!state.loading && !state.error && tab === "experiments" ? <ExperimentsView queue={state.queue} /> : null}
        {!state.loading && !state.error && tab === "automation" ? <AutomationView state={state} /> : null}
      </section>
    </>
  );
}

function ProgressView({ current, previous }: { current?: GenericRecord; previous?: GenericRecord }) {
  if (!current) return <section className="ops-panel"><h2>No weekly progress record</h2><p>Run <code>npm run automation:weekly-progress</code> after a validated merged snapshot exists.</p></section>;
  const metrics = [
    ["Users", current.traffic?.users, current.weekOverWeek?.traffic?.users], ["Sessions", current.traffic?.sessions, current.weekOverWeek?.traffic?.sessions],
    ["Pageviews", current.traffic?.pageviews, current.weekOverWeek?.traffic?.pageviews], ["Return visitors", current.traffic?.returnVisitors, current.weekOverWeek?.traffic?.returnVisitors],
    ["Search impressions", current.search?.impressions, current.weekOverWeek?.search?.impressions], ["Search clicks", current.search?.clicks, current.weekOverWeek?.search?.clicks],
    ["Visible pages", current.search?.visiblePages, current.weekOverWeek?.search?.visiblePages], ["Live-card clicks", current.product?.liveCardClicks, current.weekOverWeek?.product?.liveCardClicks],
  ];
  return <div className="ops-view-stack">
    <section className="ops-panel ops-week-heading"><div><p className="section-eyebrow">{current.week}</p><h2>Weekly progress</h2></div><span>{timestamp(current.periodStart)} to {timestamp(current.periodEnd)}</span></section>
    <section className="ops-overview-grid">{metrics.map(([label, value, change]) => { const movement = delta(change); return <article className="ops-stat-card" key={String(label)}><p>{label}</p><strong>{number(value)}</strong><span className={movement.className}>{previous ? movement.label : "No prior week"}</span></article>; })}</section>
    <section className="ops-grid"><article className="ops-panel"><div className="ops-panel-heading"><h2>Search</h2><span>{number(current.search?.visiblePages)} visible pages</span></div><Key label="Impressions" value={number(current.search?.impressions)} /><Key label="Clicks" value={number(current.search?.clicks)} /><Key label="CTR" value={percent(current.search?.ctr)} /></article><article className="ops-panel"><div className="ops-panel-heading"><h2>Product engagement</h2><span>Aggregate events</span></div><Key label="Video starts" value={number(current.product?.videoStarts)} /><Key label="Game starts" value={number(current.product?.gameStarts)} /><Key label="Gallery opens" value={number(current.product?.galleryOpens)} /><Key label="Earthquake interactions" value={number(current.product?.earthquakeInteractions)} /></article></section>
    <section className="ops-grid"><article className="ops-panel"><div className="ops-panel-heading"><h2>Top pages</h2><span>{current.topPages?.length ?? 0} shown</span></div><div className="ops-decision-list">{(current.topPages ?? []).map((page: GenericRecord) => <div className="ops-decision-row" key={page.path}><strong>{page.path}</strong><span>{number(page.pageviews)} views / {number(page.searchImpressions)} impressions</span></div>)}</div></article><article className="ops-panel"><div className="ops-panel-heading"><h2>What changed</h2><span>{number(current.experiments?.startedThisWeek)} experiments started</span></div><ul className="ops-list">{(current.notableChanges ?? []).map((item: string) => <li key={item}>{item}</li>)}</ul><Key label="Deployments" value={number(current.releases?.deployments)} /><Key label="Completed experiments" value={number(current.experiments?.completedThisWeek)} /></article></section>
  </div>;
}

const GROUPS: Array<[string, string[]]> = [["Ideas / Queue", ["idea", "queued"]], ["Building", ["building"]], ["Awaiting Deployment", ["awaiting-production-deployment"]], ["Measuring", ["measuring"]], ["Evaluating", ["evaluating"]], ["Completed", ["completed", "rejected", "paused"]]];
function ExperimentsView({ queue }: { queue: GenericRecord | null }) {
  const items = queue?.items ?? [];
  return <div className="ops-experiment-board">{GROUPS.map(([label, statuses]) => <section className="ops-experiment-column" key={label}><div className="ops-panel-heading"><h2>{label}</h2><span>{items.filter((item: GenericRecord) => statuses.includes(item.status)).length}</span></div>{items.filter((item: GenericRecord) => statuses.includes(item.status)).map((item: GenericRecord) => <article className="ops-experiment-card" key={item.id}><div className="ops-experiment-meta"><span>{title(item.status)}</span><span>{title(item.risk)} risk</span></div><h3>{item.title}</h3><p>{item.hypothesis}</p><Key label="Target" value={(item.targetPaths ?? []).join(", ")} /><Key label="Primary metric" value={item.primaryMetric} /><Key label="Production SHA" value={shortSha(item.measurementStart?.productionReleaseSha)} /><Key label="Progress" value={item.measurement?.daysElapsed === null ? "Not started" : `Day ${item.measurement.daysElapsed} / ${item.measurementStart?.minimumDays}`} /><Key label="Evidence" value={item.measurement?.evidenceSufficient ? "Sufficient" : "Insufficient"} /><Key label="Latest" value={number(item.measurement?.metrics?.[item.primaryMetric])} /><Key label="Decision" value={title(item.decision?.result ?? item.decision?.state)} /></article>)}</section>)}</div>;
}

function AutomationView({ state }: { state: OpsState }) {
  const { sourceHealth, sourceIntake, liveRisk, deployReadiness, autonomyState, contentAudit, lowRiskFixes, opportunities } = state.reports;
  const sources = sourceHealth?.sources ?? [];
  const scoreboard = state.scoreboard?.items ?? [];
  return <div className="ops-view-stack">
    <section className="ops-overview-grid"><Stat label="Deploy" value={title(deployReadiness?.status)} meta={deployReadiness?.canAutoDeploy ? "Auto eligible" : "Review or blocked"} /><Stat label="Risk" value={title(liveRisk?.level)} meta={title(liveRisk?.approval)} /><Stat label="Autonomy" value={title(autonomyState?.status)} meta="Current control state" /><Stat label="Sources" value={title(sourceHealth?.status)} meta={timestamp(sourceHealth?.checkedAt)} /></section>
    <section className="ops-grid"><article className="ops-panel"><div className="ops-panel-heading"><h2>Deploy readiness</h2><span>{timestamp(deployReadiness?.checkedAt)}</span></div><ul className="ops-list">{(deployReadiness?.reasons ?? []).map((reason: string) => <li key={reason}>{reason}</li>)}</ul></article><article className="ops-panel"><div className="ops-panel-heading"><h2>Source intake</h2><span>{timestamp(sourceIntake?.generatedAt)}</span></div><Key label="Static items" value={number(sourceIntake?.staticItemCount)} /><Key label="Sources" value={number(sourceIntake?.sources?.length)} /></article></section>
    <section className="ops-grid"><article className="ops-panel"><div className="ops-panel-heading"><h2>Source health</h2><span>{number(sources.length)} sources</span></div>{sources.map((source: GenericRecord) => <div className="ops-source-row" key={source.id}><strong>{title(source.id)}</strong><span>{title(source.status)} / streak {number(source.healthyStreak)}</span></div>)}</article><article className="ops-panel"><div className="ops-panel-heading"><h2>Latest analytics</h2><span>{state.snapshot?.path ?? "Unavailable"}</span></div><Key label="Captured" value={timestamp(state.snapshot?.data?.capturedAt)} /><Key label="GA4" value={state.snapshot?.data?.sources?.ga4 ? "On" : "Off"} /><Key label="Search Console" value={state.snapshot?.data?.sources?.searchConsole ? "On" : "Off"} /></article></section>
    <section className="ops-grid"><article className="ops-panel"><div className="ops-panel-heading"><h2>Event decisions</h2><span>{number(scoreboard.length)}</span></div>{scoreboard.slice(0, 6).map((item: GenericRecord) => <div className="ops-decision-row" key={item.slug}><strong>{item.slug}</strong><span>{title(item.recommendation)} / score {number(item.score)}</span></div>)}</article><article className="ops-panel"><div className="ops-panel-heading"><h2>Control queues</h2><span>Current records</span></div><Key label="Content findings" value={number(contentAudit?.findings?.length)} /><Key label="Low-risk fixes" value={number(lowRiskFixes?.appliedCount)} /><Key label="Traffic opportunities" value={number(opportunities?.opportunities?.length)} /></article></section>
  </div>;
}

function Key({ label, value }: { label: string; value: string }) { return <div className="ops-key-value"><span>{label}</span><strong>{value}</strong></div>; }
function Stat({ label, value, meta }: { label: string; value: string; meta: string }) { return <article className="ops-stat-card"><p>{label}</p><strong>{value}</strong><span>{meta}</span></article>; }
