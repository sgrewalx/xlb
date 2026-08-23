import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import { getGoogleAccessToken } from "./shared/google-auth.mjs";

const OUTPUT_DIRECTORY = new URL("../snapshots/", import.meta.url);
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const DEFAULT_EXPECTED_ORIGIN = "https://xlb.codemachine.in";
const TOTAL_METRICS = ["totalUsers", "sessions", "screenPageViews", "eventCount"];
const ENGAGEMENT_EVENTS = [
  "watch_source",
  "open_source",
  "video_play_start",
  "video_play_complete",
  "video_scroll_depth",
  "game_start",
  "game_complete",
  "gallery_card_open",
  "home_live_card_click",
  "return_visit_entry",
];

async function main() {
  const propertyId = process.env.GA4_PROPERTY_ID?.trim();
  const expectedMeasurementId = process.env.VITE_GA_MEASUREMENT_ID?.trim();

  if (!propertyId) {
    throw new Error("Missing GA4_PROPERTY_ID.");
  }
  if (!expectedMeasurementId) {
    throw new Error("Missing VITE_GA_MEASUREMENT_ID.");
  }

  const { accessToken } = await getGoogleAccessToken([GA4_SCOPE]);
  const snapshot = await fetchGa4Snapshot({
    accessToken,
    propertyId,
    expectedMeasurementId,
    expectedOrigin: process.env.XLB_GA4_EXPECTED_ORIGIN || DEFAULT_EXPECTED_ORIGIN,
  });
  const outputFile = new URL(`ga4-${snapshot.capturedAt.slice(0, 10)}.json`, OUTPUT_DIRECTORY);
  const changed = await writeJsonIfChanged(outputFile, snapshot);

  console.log(
    changed
      ? `Updated automation/snapshots/ga4-${snapshot.capturedAt.slice(0, 10)}.json from the GA4 Data API`
      : `automation/snapshots/ga4-${snapshot.capturedAt.slice(0, 10)}.json already matched GA4 Data API output`,
  );
}

export async function fetchGa4Snapshot({
  accessToken,
  propertyId,
  expectedMeasurementId,
  expectedOrigin = DEFAULT_EXPECTED_ORIGIN,
  window = getGa4Window(),
  request = fetch,
}) {
  assertGa4Configuration({ propertyId, expectedMeasurementId });
  const stream = await verifyGa4StreamIdentity({
    accessToken,
    propertyId,
    expectedMeasurementId,
    expectedOrigin,
    request,
  });
  const streamFilter = createStreamIdFilter(stream.streamId);
  const [pageReport, totalsReport, outboundReport] = await Promise.all([
    runGa4Report({
      accessToken,
      propertyId,
      request,
      body: {
        dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [
          { name: "screenPageViews" },
          { name: "sessions" },
          { name: "engagementRate" },
          { name: "averageSessionDuration" },
        ],
        dimensionFilter: streamFilter,
        keepEmptyRows: false,
        limit: "10000",
      },
    }),
    runGa4Report({
      accessToken,
      propertyId,
      request,
      body: {
        dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
        metrics: TOTAL_METRICS.map((name) => ({ name })),
        dimensionFilter: streamFilter,
        keepEmptyRows: true,
      },
    }),
    runGa4Report({
      accessToken,
      propertyId,
      request,
      body: {
        dateRanges: [{ startDate: window.startDate, endDate: window.endDate }],
        dimensions: [{ name: "pagePath" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              streamFilter,
              {
                filter: {
                  fieldName: "eventName",
                  inListFilter: {
                    values: ENGAGEMENT_EVENTS,
                  },
                },
              },
            ],
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
      pageviews: toRequiredNumber(row.metricValues?.[0]?.value, "screenPageViews"),
      visits: toRequiredNumber(row.metricValues?.[1]?.value, "sessions"),
      searchImpressions: 0,
      searchCtr: 0,
      avgPosition: 0,
      watchClicks: 0,
      videoStarts: 0,
      videoCompletes: 0,
      videoScrollDepth: 0,
      gameStarts: 0,
      gameCompletes: 0,
      galleryOpens: 0,
      liveCardClicks: 0,
      returnVisitors: 0,
      revenueUsd: 0,
      engagementScore: computeEngagementScore(
        toRequiredNumber(row.metricValues?.[2]?.value, "engagementRate"),
        toRequiredNumber(row.metricValues?.[3]?.value, "averageSessionDuration"),
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
    const eventName = row.dimensionValues?.[1]?.value ?? "";
    const count = toRequiredNumber(row.metricValues?.[0]?.value, "eventCount");

    if (eventName === "watch_source" || eventName === "open_source") {
      page.watchClicks += count;
    }
    if (eventName === "video_play_start") {
      page.videoStarts += count;
    }
    if (eventName === "video_play_complete") {
      page.videoCompletes += count;
    }
    if (eventName === "video_scroll_depth") {
      page.videoScrollDepth += count;
    }
    if (eventName === "game_start") {
      page.gameStarts += count;
    }
    if (eventName === "game_complete") {
      page.gameCompletes += count;
    }
    if (eventName === "gallery_card_open") {
      page.galleryOpens += count;
    }
    if (eventName === "home_live_card_click") {
      page.liveCardClicks += count;
    }
    if (eventName === "return_visit_entry") {
      page.returnVisitors += count;
    }
  }

  const totals = parseGa4Totals(totalsReport);
  const rowCount = parseRowCount(pageReport);
  const dataStatus = classifyGa4Data({ totals, rowCount, pageCount: pageMap.size });
  if (dataStatus === "inconsistent") {
    throw new Error("GA4 response is inconsistent: totals and page rows do not reconcile");
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
    ga4: {
      propertyId: String(propertyId),
      streamVerified: true,
      stream,
      rowCount,
      totals,
      dataStatus,
    },
    pages: [...pageMap.values()],
  };
}

export async function runGa4Report({ accessToken, propertyId, body, request = fetch }) {
  const response = await request(
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

export async function verifyGa4StreamIdentity({
  accessToken,
  propertyId,
  expectedMeasurementId,
  expectedOrigin = DEFAULT_EXPECTED_ORIGIN,
  request = fetch,
}) {
  assertGa4Configuration({ propertyId, expectedMeasurementId });
  const response = await request(
    `https://analyticsadmin.googleapis.com/v1beta/properties/${propertyId}/dataStreams?pageSize=200`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    },
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GA4 Admin API request failed: ${response.status}`);
  }

  const expectedHost = parseExpectedHost(expectedOrigin);
  const stream = (json.dataStreams ?? []).find((item) => {
    if (item?.type !== "WEB_DATA_STREAM") {
      return false;
    }
    if (item.webStreamData?.measurementId !== expectedMeasurementId) {
      return false;
    }
    if (!item.webStreamData.defaultUri) {
      return true;
    }
    try {
      return new URL(item.webStreamData.defaultUri).hostname.toLowerCase() === expectedHost;
    } catch {
      return false;
    }
  });

  if (!stream) {
    throw new Error("GA4 property does not contain the expected XLB web data stream");
  }
  const streamId = extractGa4StreamId(stream.name, propertyId);

  return {
    name: stream.name,
    streamId,
    type: stream.type,
    displayName: String(stream.displayName ?? ""),
    measurementId: stream.webStreamData.measurementId,
    defaultUri: stream.webStreamData.defaultUri || null,
  };
}

export function extractGa4StreamId(streamName, propertyId) {
  const match = /^properties\/(\d+)\/dataStreams\/(\d+)$/.exec(String(streamName ?? ""));
  if (!match || match[1] !== String(propertyId)) {
    throw new Error("GA4 property does not contain the expected XLB web data stream");
  }
  return match[2];
}

export function createStreamIdFilter(streamId) {
  if (!/^\d+$/.test(String(streamId ?? ""))) {
    throw new Error("Verified GA4 stream ID must be numeric");
  }
  return {
    filter: {
      fieldName: "streamId",
      stringFilter: {
        matchType: "EXACT",
        value: String(streamId),
      },
    },
  };
}

export function parseGa4Totals(report) {
  const values = report?.rows?.[0]?.metricValues;
  if (!Array.isArray(values) || values.length !== TOTAL_METRICS.length) {
    throw new Error("GA4 totals report is missing required metrics");
  }

  return Object.fromEntries(TOTAL_METRICS.map((name, index) => {
    const value = toRequiredNumber(values[index]?.value, name);
    return [name, value];
  }));
}

export function classifyGa4Data({ totals, rowCount, pageCount }) {
  const hasEvents = TOTAL_METRICS.some((name) => totals[name] > 0);
  const hasRows = rowCount > 0 || pageCount > 0;

  if (!hasEvents && !hasRows) {
    return "no-events-observed";
  }
  if (hasEvents && rowCount > 0 && pageCount > 0 && rowCount === pageCount) {
    return "data";
  }
  return "inconsistent";
}

function parseRowCount(report) {
  const rowCount = Number(report?.rowCount);
  if (!Number.isInteger(rowCount) || rowCount < 0) {
    throw new Error("GA4 page report rowCount is missing or invalid");
  }
  return rowCount;
}

function parseExpectedHost(origin) {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    throw new Error("XLB_GA4_EXPECTED_ORIGIN must be a valid URL");
  }
}

function assertGa4Configuration({ propertyId, expectedMeasurementId }) {
  if (!/^\d+$/.test(String(propertyId ?? ""))) {
    throw new Error("GA4_PROPERTY_ID must be numeric");
  }
  if (!/^G-[A-Z0-9]+$/i.test(String(expectedMeasurementId ?? ""))) {
    throw new Error("VITE_GA_MEASUREMENT_ID is invalid");
  }
}

export function getGa4Window({
  snapshotDate = process.env.XLB_SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10),
  lookbackDays = Number(process.env.XLB_GA4_LOOKBACK_DAYS ?? 1),
} = {}) {
  const anchor = new Date(`${snapshotDate}T00:00:00.000Z`);

  if (Number.isNaN(anchor.valueOf())) {
    throw new Error(`Invalid XLB_SNAPSHOT_DATE: ${snapshotDate}`);
  }
  if (!Number.isInteger(lookbackDays) || lookbackDays <= 0) {
    throw new Error(`Invalid XLB_GA4_LOOKBACK_DAYS: ${lookbackDays}`);
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

function toRequiredNumber(value, label) {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") {
    throw new Error(`GA4 response contains a missing ${label} value`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`GA4 response contains an invalid ${label} value`);
  }
  return number;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
