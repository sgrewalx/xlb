import { useEffect, useState } from "react";
import { Seo } from "../components/Seo";

type GenericRecord = Record<string, unknown>;

type OpsState = {
  loading: boolean;
  error: string | null;
  reports: Record<string, GenericRecord | null>;
  snapshot: GenericRecord | null;
  scoreboard: GenericRecord | null;
};

type JsonModule = { default: GenericRecord };
type JsonLoader = () => Promise<JsonModule>;

const reportModules = import.meta.glob<JsonModule>("../../automation/reports/*.json") as Record<string, JsonLoader>;
const snapshotModules = import.meta.glob<JsonModule>("../../automation/snapshots/*.json") as Record<string, JsonLoader>;

function toTitleCase(value: string) {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return "Unavailable";
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(parsed));
}

function formatPercent(value: unknown) {
  if (typeof value !== "number") {
    return "0%";
  }

  return `${Math.round(value * 100)}%`;
}

function formatNumber(value: unknown) {
  return typeof value === "number" ? value.toLocaleString("en") : "0";
}

async function loadJsonModule(pathSuffix: string) {
  const entry = Object.entries(reportModules).find(([path]) => path.endsWith(pathSuffix));
  if (!entry) {
    return null;
  }

  const loaded = await entry[1]();
  return (loaded as { default: GenericRecord }).default;
}

async function loadLatestMergedSnapshot() {
  const entries = Object.entries(snapshotModules).filter(([path]) => path.includes("/merged-"));
  if (!entries.length) {
    return null;
  }

  const [latestPath, loader] = [...entries].sort(([left], [right]) => right.localeCompare(left))[0];
  const loaded = await loader();

  return {
    path: latestPath.split("/").pop() ?? latestPath,
    data: (loaded as { default: GenericRecord }).default,
  };
}

export default function OpsDashboardPage() {
  const [state, setState] = useState<OpsState>({
    loading: true,
    error: null,
    reports: {},
    snapshot: null,
    scoreboard: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [sourceHealth, sourceIntake, liveRisk, deployReadiness, autonomyState, latestSnapshot, scoreboard] =
          await Promise.all([
            loadJsonModule("live-source-health.json"),
            loadJsonModule("live-source-intake.json"),
            loadJsonModule("live-risk-report.json"),
            loadJsonModule("deploy-readiness.json"),
            loadJsonModule("autonomy-state.json"),
            loadLatestMergedSnapshot(),
            fetch("/content/live/scoreboard.json").then((response) => {
              if (!response.ok) {
                throw new Error("Could not load live scoreboard");
              }

              return response.json() as Promise<GenericRecord>;
            }),
          ]);

        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: null,
          reports: {
            sourceHealth,
            sourceIntake,
            liveRisk,
            deployReadiness,
            autonomyState,
          },
          snapshot: latestSnapshot,
          scoreboard,
        });
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : "Could not load local ops data",
          }));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const sourceHealth = state.reports.sourceHealth as
    | { status?: string; checkedAt?: string; stability?: GenericRecord; sources?: GenericRecord[] }
    | undefined;
  const sourceIntake = state.reports.sourceIntake as
    | { generatedAt?: string; staticItemCount?: number; sources?: GenericRecord[] }
    | undefined;
  const liveRisk = state.reports.liveRisk as
    | {
        level?: string;
        assessedAt?: string;
        approval?: string;
        reasons?: string[];
        analyticsSignals?: GenericRecord;
      }
    | undefined;
  const deployReadiness = state.reports.deployReadiness as
    | { status?: string; checkedAt?: string; canAutoDeploy?: boolean; reasons?: string[] }
    | undefined;
  const autonomyState = state.reports.autonomyState as
    | { status?: string; streaks?: GenericRecord; thresholds?: GenericRecord }
    | undefined;
  const snapshot = state.snapshot as
    | { path?: string; data?: { capturedAt?: string; window?: GenericRecord; sources?: GenericRecord; pages?: GenericRecord[] } }
    | null;
  const scoreboard = state.scoreboard as { updatedAt?: string; items?: GenericRecord[] } | null;

  const overviewCards = [
    {
      label: "Deploy",
      value: toTitleCase(deployReadiness?.status ?? "unknown"),
      meta: deployReadiness?.canAutoDeploy ? "Can auto-deploy" : "Needs review",
    },
    {
      label: "Risk",
      value: toTitleCase(liveRisk?.level ?? "unknown"),
      meta: liveRisk?.approval ? toTitleCase(liveRisk.approval) : "No approval state",
    },
    {
      label: "Autonomy",
      value: toTitleCase(autonomyState?.status ?? "unknown"),
      meta: autonomyState?.streaks
        ? `Healthy ${formatNumber(autonomyState.streaks.healthySource)} / Analytics ${formatNumber(
            autonomyState.streaks.analyticsCoverage,
          )}`
        : "No maturity streaks",
    },
    {
      label: "Sources",
      value: toTitleCase(sourceHealth?.status ?? "unknown"),
      meta: sourceHealth?.stability?.status ? toTitleCase(String(sourceHealth.stability.status)) : "No stability state",
    },
  ];

  const analyticsSignals = liveRisk?.analyticsSignals ?? {};
  const sources = Array.isArray(sourceHealth?.sources) ? sourceHealth.sources : [];
  const scoreboardItems = Array.isArray(scoreboard?.items) ? scoreboard.items : [];
  const topPages = Array.isArray(snapshot?.data?.pages) ? snapshot.data.pages.slice(0, 6) : [];
  const stabilityStatus = sourceHealth?.stability?.status ? toTitleCase(String(sourceHealth.stability.status)) : "Unknown";

  return (
    <>
      <Seo
        title="Ops Dashboard | XLB"
        description="Local-only view of automation health, ranking, and deploy readiness."
        path="/__ops"
      />
      <section className="ops-page">
        <div className="ops-hero">
          <div className="ops-hero-copy">
            <p className="section-eyebrow">Local Ops</p>
            <h1>Automation status, source health, and deploy readiness.</h1>
            <p>
              This route exists only in local development. It reads the latest local snapshots and reports generated by
              the automation pipeline.
            </p>
          </div>
          <div className="ops-hero-rail">
            <div className="ops-pill">
              <span>Deploy</span>
              <strong>{toTitleCase(deployReadiness?.status ?? "unknown")}</strong>
            </div>
            <div className="ops-pill">
              <span>Risk</span>
              <strong>{toTitleCase(liveRisk?.level ?? "unknown")}</strong>
            </div>
            <div className="ops-pill">
              <span>Source Stability</span>
              <strong>{stabilityStatus}</strong>
            </div>
          </div>
        </div>

        {state.loading ? (
          <section className="ops-panel">
            <h2>Loading</h2>
            <p>Reading local reports and snapshots.</p>
          </section>
        ) : null}

        {state.error ? (
          <section className="ops-panel">
            <h2>Could not load ops data</h2>
            <p>{state.error}</p>
          </section>
        ) : null}

        {!state.loading && !state.error ? (
          <>
            <section className="ops-overview-grid">
              {overviewCards.map((card) => (
                <article className={`ops-stat-card ops-stat-card-${card.label.toLowerCase()}`} key={card.label}>
                  <p>{card.label}</p>
                  <strong>{card.value}</strong>
                  <span>{card.meta}</span>
                </article>
              ))}
            </section>

            <section className="ops-grid">
              <article className="ops-panel">
                <div className="ops-panel-heading">
                  <h2>Deploy State</h2>
                  <span>{formatTimestamp(deployReadiness?.checkedAt)}</span>
                </div>
                <div className="ops-key-value">
                  <span>Status</span>
                  <strong>{toTitleCase(deployReadiness?.status ?? "unknown")}</strong>
                </div>
                <div className="ops-key-value">
                  <span>Auto-deploy</span>
                  <strong>{deployReadiness?.canAutoDeploy ? "Enabled" : "Blocked"}</strong>
                </div>
                <ul className="ops-list">
                  {(deployReadiness?.reasons ?? []).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </article>

              <article className="ops-panel">
                <div className="ops-panel-heading">
                  <h2>Analytics Coverage</h2>
                  <span>{formatTimestamp(liveRisk?.assessedAt)}</span>
                </div>
                <div className="ops-key-value">
                  <span>Coverage ratio</span>
                  <strong>{formatPercent(analyticsSignals.eventCoverageRatio)}</strong>
                </div>
                <div className="ops-key-value">
                  <span>GA4 enabled</span>
                  <strong>{analyticsSignals.ga4Enabled ? "Yes" : "No"}</strong>
                </div>
                <div className="ops-key-value">
                  <span>Search Console enabled</span>
                  <strong>{analyticsSignals.searchConsoleEnabled ? "Yes" : "No"}</strong>
                </div>
                <div className="ops-key-value">
                  <span>Decision coverage</span>
                  <strong>{analyticsSignals.hasDecisionCoverage ? "Enough" : "Too thin"}</strong>
                </div>
              </article>
            </section>

            <section className="ops-grid">
              <article className="ops-panel">
                <div className="ops-panel-heading">
                  <h2>Source Health</h2>
                  <span>{formatTimestamp(sourceHealth?.checkedAt)}</span>
                </div>
                <div className="ops-source-list">
                  {sources.map((source) => (
                    <div className="ops-source-row" key={String(source.id)}>
                      <div>
                        <strong>{toTitleCase(String(source.id ?? "unknown"))}</strong>
                        <p>
                          {toTitleCase(String(source.status ?? "unknown"))} · Stable:{" "}
                          {source.stable ? "Yes" : "No"}
                        </p>
                      </div>
                      <div className="ops-source-metrics">
                        <span>Healthy streak {formatNumber(source.healthyStreak)}</span>
                        <span>Non-fallback {formatNumber(source.nonFallbackStreak)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="ops-panel">
                <div className="ops-panel-heading">
                  <h2>Source Intake</h2>
                  <span>{formatTimestamp(sourceIntake?.generatedAt)}</span>
                </div>
                <div className="ops-key-value">
                  <span>Static items</span>
                  <strong>{formatNumber(sourceIntake?.staticItemCount)}</strong>
                </div>
                <div className="ops-source-metrics ops-source-metrics-stacked">
                  {(sourceIntake?.sources ?? []).map((source) => (
                    <span key={String(source.id)}>
                      {toTitleCase(String(source.id ?? "unknown"))}: {formatNumber(source.freshSeedCount)} fresh /{" "}
                      {formatNumber(source.staleSeedCount)} stale
                    </span>
                  ))}
                </div>
              </article>
            </section>

            <section className="ops-grid">
              <article className="ops-panel">
                <div className="ops-panel-heading">
                  <h2>Top Event Decisions</h2>
                  <span>{formatTimestamp(scoreboard?.updatedAt)}</span>
                </div>
                <div className="ops-decision-list">
                  {scoreboardItems.slice(0, 6).map((item) => (
                    <div className="ops-decision-row" key={String(item.slug)}>
                      <div>
                        <strong>{String(item.slug)}</strong>
                        <p>
                          {toTitleCase(String(item.recommendation ?? "review"))} · {toTitleCase(String(item.recencyBand ?? "unknown"))}
                        </p>
                      </div>
                      <div className="ops-source-metrics">
                        <span>Score {formatNumber(item.score)}</span>
                        <span>Views {formatNumber(item.pageviews)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="ops-panel">
                <div className="ops-panel-heading">
                  <h2>Latest Snapshot</h2>
                  <span>{snapshot?.path ?? "No merged snapshot"}</span>
                </div>
                <div className="ops-key-value">
                  <span>Captured</span>
                  <strong>{formatTimestamp(snapshot?.data?.capturedAt)}</strong>
                </div>
                <div className="ops-key-value">
                  <span>Window start</span>
                  <strong>{formatTimestamp(snapshot?.data?.window?.start)}</strong>
                </div>
                <div className="ops-key-value">
                  <span>Window end</span>
                  <strong>{formatTimestamp(snapshot?.data?.window?.end)}</strong>
                </div>
                <div className="ops-source-metrics ops-source-metrics-stacked">
                  <span>GA4: {snapshot?.data?.sources?.ga4 ? "On" : "Off"}</span>
                  <span>Search Console: {snapshot?.data?.sources?.searchConsole ? "On" : "Off"}</span>
                  <span>Cloudflare: {snapshot?.data?.sources?.cloudflare ? "On" : "Off"}</span>
                </div>
              </article>
            </section>

            <section className="ops-panel">
              <div className="ops-panel-heading">
                <h2>Top Pages In Snapshot</h2>
                <span>{topPages.length} pages shown</span>
              </div>
              <div className="ops-table">
                <div className="ops-table-head">
                  <span>Path</span>
                  <span>Pageviews</span>
                  <span>Watch clicks</span>
                  <span>Engagement</span>
                </div>
                {topPages.map((page) => (
                  <div className="ops-table-row" key={String(page.path)}>
                    <span>{String(page.path)}</span>
                    <span>{formatNumber(page.pageviews)}</span>
                    <span>{formatNumber(page.watchClicks)}</span>
                    <span>{formatNumber(page.engagementScore)}</span>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </section>
    </>
  );
}
