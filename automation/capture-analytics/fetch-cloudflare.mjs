import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeJsonIfChanged } from "../shared/content-writer.mjs";

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const QUERY_FILE = new URL("./queries/live-event-pages.gql", import.meta.url);
const RAW_OUTPUT_FILE = new URL("../snapshots/cloudflare-raw-latest.json", import.meta.url);

async function main() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const zoneTag = process.env.CLOUDFLARE_ZONE_TAG;
  const start = process.env.XLB_CF_START;
  const end = process.env.XLB_CF_END;

  if (!apiToken || !zoneTag || !start || !end) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_TAG, XLB_CF_START, and XLB_CF_END must be set. This script is only for sites configured as Cloudflare zones.",
    );
  }

  const query = await readFile(QUERY_FILE, "utf8");

  const payload = {
    query,
    variables: {
      zoneTag,
      start,
      end,
    },
  };

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Cloudflare GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`Cloudflare GraphQL returned errors: ${JSON.stringify(json.errors)}`);
  }

  const rawOutputPath = fileURLToPath(RAW_OUTPUT_FILE);
  await writeFile(rawOutputPath, `${JSON.stringify(json, null, 2)}\n`, "utf8");

  const normalizedSnapshot = normalizeCloudflareResponse(json, start, end);
  const datedSnapshotName = `daily-${normalizedSnapshot.capturedAt.slice(0, 10)}.json`;
  const snapshotFile = new URL(`../snapshots/${datedSnapshotName}`, import.meta.url);
  const changed = await writeJsonIfChanged(snapshotFile, normalizedSnapshot);

  console.log(
    changed
      ? `Updated ${path.posix.join("automation/snapshots", datedSnapshotName)}`
      : `${path.posix.join("automation/snapshots", datedSnapshotName)} already matched normalized output`,
  );
}

function normalizeCloudflareResponse(payload, start, end) {
  const groups =
    payload?.data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];

  return {
    capturedAt: new Date().toISOString(),
    window: {
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    },
    sources: {
      cloudflare: true,
      searchConsole: false,
      ga4: false,
      adsense: false,
    },
    pages: groups.map((group) => ({
      path: group?.dimensions?.clientRequestPath ?? "",
      pageviews: totalBrowserPageViews(group?.sum?.browserMap),
      visits: 0,
      searchImpressions: 0,
      searchCtr: 0,
      avgPosition: 0,
      watchClicks: 0,
      revenueUsd: 0,
      engagementScore: inferEngagementScore(totalBrowserPageViews(group?.sum?.browserMap)),
      decision: "review",
      notes: "Imported from Cloudflare GraphQL Analytics.",
    })),
  };
}

function totalBrowserPageViews(browserMap) {
  if (!Array.isArray(browserMap)) {
    return 0;
  }

  return browserMap.reduce((total, entry) => total + (entry?.pageViews ?? 0), 0);
}

function inferEngagementScore(pageviews) {
  if (pageviews >= 300) {
    return 85;
  }

  if (pageviews >= 150) {
    return 70;
  }

  if (pageviews >= 75) {
    return 55;
  }

  return 35;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
