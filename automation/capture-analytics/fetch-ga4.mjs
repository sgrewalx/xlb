import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import { getGoogleAccessToken } from "./shared/google-auth.mjs";

const OUTPUT_DIRECTORY = new URL("../snapshots/", import.meta.url);
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";

async function main() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();

  if (!propertyId) {
    throw new Error("Missing GA4_PROPERTY_ID.");
  }

  const snapshot = await fetchGa4Snapshot(propertyId);
  const outputFile = new URL(`ga4-${snapshot.capturedAt.slice(0, 10)}.json`, OUTPUT_DIRECTORY);
  const changed = await writeJsonIfChanged(outputFile, snapshot);

  console.log(
    changed
      ? `Updated automation/snapshots/ga4-${snapshot.capturedAt.slice(0, 10)}.json from the GA4 Data API`
      : `automation/snapshots/ga4-${snapshot.capturedAt.slice(0, 10)}.json already matched GA4 Data API output`,
  );
}

async function fetchGa4Snapshot(propertyId) {
  const { accessToken } = await getGoogleAccessToken([GA4_SCOPE]);
  const window = getGa4Window();
  const [pageReport, outboundReport] = await Promise.all([
    runGa4Report({
      accessToken,
      propertyId,
      body: {
        dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "sessions" },
          { name: "engagementRate" },
          { name: "averageSessionDuration" },
        ],
        keepEmptyRows: false,
        limit: "10000",
      },
    }),
    runGa4Report({
      accessToken,
      propertyId,
      body: {
        dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
        dimensions: [{ name: "pagePath" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: ["watch_source", "open_source"],
            },
          },
        },
        keepEmptyRows: false,
        limit: "10000",
      },
    }),
  ]);

  const pageMap = new Map();

  for (const row of pageReport.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value ?? "";
    if (!path) {
      continue;
    }

    pageMap.set(path, {
      path,
      pageviews: toNumber(row.metricValues?.[0]?.value),
      visits: toNumber(row.metricValues?.[1]?.value),
      searchImpressions: 0,
      searchCtr: 0,
      avgPosition: 0,
      watchClicks: 0,
      revenueUsd: 0,
      engagementScore: computeEngagementScore(
        toNumber(row.metricValues?.[2]?.value),
        toNumber(row.metricValues?.[3]?.value),
      ),
      decision: "review",
      notes: "Imported from the GA4 Data API.",
    });
  }

  for (const row of outboundReport.rows ?? []) {
    const path = row.dimensionValues?.[0]?.value ?? "";
    if (!path || !pageMap.has(path)) {
      continue;
    }

    const page = pageMap.get(path);
    page.watchClicks += toNumber(row.metricValues?.[0]?.value);
  }

  return {
    capturedAt: window.capturedAt,
    window: {
      start: window.startIso,
      end: window.endIso,
    },
    sources: {
      cloudflare: false,
      searchConsole: false,
      ga4: true,
      adsense: false,
    },
    pages: [...pageMap.values()],
  };
}

async function runGa4Report({ accessToken, propertyId, body }) {
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`GA4 Data API request failed: ${response.status} ${JSON.stringify(json)}`);
  }

  return json;
}

function getGa4Window() {
  const snapshotDate = process.env.XLB_SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10);
  const lookbackDays = Number(process.env.XLB_GA4_LOOKBACK_DAYS ?? 1);
  const anchor = new Date(`${snapshotDate}T00:00:00.000Z`);

  if (Number.isNaN(anchor.valueOf())) {
    throw new Error(`Invalid XLB_SNAPSHOT_DATE: ${snapshotDate}`);
  }

  const endExclusive = new Date(anchor);
  const endInclusive = new Date(anchor);
  endInclusive.setUTCDate(endInclusive.getUTCDate() - 1);
  const startInclusive = new Date(endInclusive);
  startInclusive.setUTCDate(startInclusive.getUTCDate() - Math.max(lookbackDays - 1, 0));

  return {
    capturedAt: new Date(`${snapshotDate}T06:00:00.000Z`).toISOString(),
    startDate: startInclusive.toISOString().slice(0, 10),
    endDate: endInclusive.toISOString().slice(0, 10),
    startIso: startInclusive.toISOString(),
    endIso: endExclusive.toISOString(),
  };
}

function computeEngagementScore(rate, durationSeconds) {
  const ratePoints = Math.round(rate * 70);
  const durationPoints = Math.min(Math.round(durationSeconds / 3), 30);
  return ratePoints + durationPoints;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
