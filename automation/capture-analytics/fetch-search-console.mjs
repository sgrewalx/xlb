import { writeJsonIfChanged } from "../shared/content-writer.mjs";
import { getGoogleAccessToken } from "./shared/google-auth.mjs";

const OUTPUT_DIRECTORY = new URL("../snapshots/", import.meta.url);
const SEARCH_CONSOLE_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

async function main() {
  const siteUrl = process.env.SEARCH_CONSOLE_SITE_URL?.trim();

  if (!siteUrl) {
    throw new Error("Missing SEARCH_CONSOLE_SITE_URL.");
  }

  const snapshot = await fetchSearchConsoleSnapshot(siteUrl);
  const outputFile = new URL(
    `search-console-${snapshot.capturedAt.slice(0, 10)}.json`,
    OUTPUT_DIRECTORY,
  );
  const changed = await writeJsonIfChanged(outputFile, snapshot);

  console.log(
    changed
      ? `Updated automation/snapshots/search-console-${snapshot.capturedAt.slice(0, 10)}.json from the Search Console API`
      : `automation/snapshots/search-console-${snapshot.capturedAt.slice(0, 10)}.json already matched Search Console API output`,
  );
}

async function fetchSearchConsoleSnapshot(siteUrl) {
  const { accessToken } = await getGoogleAccessToken([SEARCH_CONSOLE_SCOPE]);
  const window = getSearchConsoleWindow();
  const rows = await runSearchConsoleQuery({
    accessToken,
    siteUrl,
    body: {
      startDate: window.startDate,
      endDate: window.endDate,
      dimensions: ["page"],
      rowLimit: 25000,
      dataState: "final",
    },
  });

  return {
    capturedAt: window.capturedAt,
    window: {
      start: window.startIso,
      end: window.endExclusiveIso,
    },
    sources: {
      cloudflare: false,
      searchConsole: true,
      ga4: false,
      adsense: false,
    },
    pages: rows.map((row) => ({
      path: toPath(row.keys?.[0]),
      pageviews: 0,
      visits: 0,
      searchImpressions: toNumber(row.impressions),
      searchCtr: toNumber(row.ctr),
      avgPosition: toNumber(row.position),
      watchClicks: 0,
      revenueUsd: 0,
      engagementScore: 0,
      decision: "review",
      notes: "Imported from the Search Console API.",
    })),
  };
}

async function runSearchConsoleQuery({ accessToken, siteUrl, body }) {
  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
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
    throw new Error(`Search Console API request failed: ${response.status} ${JSON.stringify(json)}`);
  }

  return Array.isArray(json.rows) ? json.rows : [];
}

function getSearchConsoleWindow() {
  const snapshotDate = process.env.XLB_SNAPSHOT_DATE ?? new Date().toISOString().slice(0, 10);
  const lagDays = Number(process.env.XLB_SEARCH_CONSOLE_LAG_DAYS ?? 2);
  const lookbackDays = Number(process.env.XLB_SEARCH_CONSOLE_LOOKBACK_DAYS ?? 7);
  const anchor = new Date(`${snapshotDate}T00:00:00.000Z`);

  if (Number.isNaN(anchor.valueOf())) {
    throw new Error(`Invalid XLB_SNAPSHOT_DATE: ${snapshotDate}`);
  }

  const endInclusive = new Date(anchor);
  endInclusive.setUTCDate(endInclusive.getUTCDate() - Math.max(lagDays, 1));
  const startInclusive = new Date(endInclusive);
  startInclusive.setUTCDate(startInclusive.getUTCDate() - Math.max(lookbackDays - 1, 0));
  const endExclusive = new Date(endInclusive);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

  return {
    capturedAt: new Date(`${snapshotDate}T06:00:00.000Z`).toISOString(),
    startDate: startInclusive.toISOString().slice(0, 10),
    endDate: endInclusive.toISOString().slice(0, 10),
    startIso: startInclusive.toISOString(),
    endExclusiveIso: endExclusive.toISOString(),
  };
}

function toPath(value) {
  const text = String(value ?? "").trim();

  if (!text) {
    return "";
  }

  try {
    return new URL(text).pathname || "/";
  } catch {
    return text.startsWith("/") ? text : `/${text}`;
  }
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
