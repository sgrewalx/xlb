# XLB Analytics Sources

## Recommended Source Order

For the current XLB setup, the automation loop should prefer:

1. Google Analytics 4
2. Google Search Console
3. Google AdSense
4. Cloudflare Web Analytics as an optional supplemental signal

## Why Cloudflare Is Optional

XLB is hosted on AWS and the domain is not configured as a Cloudflare DNS zone.
That means Cloudflare Web Analytics can still be used through the JavaScript snippet,
but the zone-based GraphQL fetch path is not the default assumption for automation.

In practice:

- snippet-only Cloudflare analytics can remain useful as a dashboard or manual source
- normalized snapshots should be importable from any source system
- the repo should not assume that a `CLOUDFLARE_ZONE_TAG` exists

## Supported Local Flows

## Production Instrumentation

For soft beta, GA4 should be wired on the production site with:

- `VITE_GA_MEASUREMENT_ID`
- page view tracking enabled through the app runtime
- outbound watch/source click tracking enabled on live event cards and event pages

Example local usage:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run dev
```

Example production build usage:

```bash
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX npm run build
```

Current tracked GA4 behaviors in the app:

- route/page views
- `watch_source` outbound clicks
- `open_source` outbound clicks

## Automated Production Ingestion

The site already emits real GA4 telemetry in production.
To make the **automation loop** consume real analytics, configure:

- GitHub secret: `GOOGLE_SERVICE_ACCOUNT_JSON`
- GitHub variable: `GA4_PROPERTY_ID`
- GitHub variable: `SEARCH_CONSOLE_SITE_URL`

Optional tuning variables:

- `XLB_GA4_LOOKBACK_DAYS`
- `XLB_SEARCH_CONSOLE_LAG_DAYS`
- `XLB_SEARCH_CONSOLE_LOOKBACK_DAYS`

The refresh workflow will then prefer:

- `npm run automation:fetch-ga4`
- `npm run automation:fetch-search-console`

and fall back to the existing sample/import path only when the Google credentials or IDs are missing.

Important setup notes:

- the GA4 service account must have access to the GA4 property
- the same service account email must be added to the Search Console property
- without those permissions, the workflow will keep using fallback imports

Current setup note:

- `SEARCH_CONSOLE_SITE_URL` is set to `https://xlb.codemachine.in/`
- `XLB_GA4_LOOKBACK_DAYS`, `XLB_SEARCH_CONSOLE_LAG_DAYS`, and `XLB_SEARCH_CONSOLE_LOOKBACK_DAYS` are configured in GitHub Actions variables
- `GA4_PROPERTY_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` still need to be added before the daily workflow can consume live Google API data

### 1. Import a normalized snapshot

Use when you already have data in the normalized snapshot shape:

```bash
XLB_ANALYTICS_SOURCE=./path/to/snapshot.json npm run automation:analytics
```

### 2. Import GA4 and Search Console style exports

Use when you have export-style JSON or CSV from your reporting stack:

```bash
npm run automation:import-ga4
npm run automation:import-search-console
npm run automation:merge-analytics
```

The merge step produces a single combined snapshot that the ranking job can use.

### 2b. Fetch live GA4 and Search Console data via Google APIs

Use when Google service-account credentials and property IDs are available:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/google-service-account.json
GA4_PROPERTY_ID=123456789
SEARCH_CONSOLE_SITE_URL=https://xlb.codemachine.in/
XLB_SNAPSHOT_DATE=2026-04-02
npm run automation:fetch-ga4
npm run automation:fetch-search-console
npm run automation:merge-analytics
```

Suggested local workflow for real exports:

```bash
cp your-ga4-export.csv /home/sg/cmt7/xlb/data/analytics/ga4-export.csv
cp your-search-console-export.csv /home/sg/cmt7/xlb/data/analytics/search-console-export.csv
XLB_GA4_SOURCE=./data/analytics/ga4-export.csv npm run automation:import-ga4
XLB_SEARCH_CONSOLE_SOURCE=./data/analytics/search-console-export.csv npm run automation:import-search-console
XLB_SNAPSHOT_DATE=2026-03-27 npm run automation:merge-analytics
XLB_FORCE_COLD_START=1 XLB_ANALYTICS_SNAPSHOT=./automation/snapshots/merged-2026-03-27.json npm run automation:rank-live
npm run automation:live-events
```

Expected GA4 CSV columns:
- `path`
- `screenPageViews`
- `sessions`
- `eventCount`
- `engagementRate`
- `averageSessionDuration`
- `capturedAt`
- `windowStart`
- `windowEnd`

Expected Search Console CSV columns:
- `path`
- `clicks`
- `impressions`
- `ctr`
- `position`
- `capturedAt`
- `windowStart`
- `windowEnd`

Cold-start mode:

- set `XLB_FORCE_COLD_START=1` when traffic is effectively zero
- ranking will prioritize source quality, recurrence, rights profile, intent, and publishability over observed metrics

Autonomy graduation:

- low-risk auto-deploy is not unlocked by one good run
- the governance layer now requires a sustained streak of healthy runs and real analytics coverage
- the source layer also needs a sustained non-fallback stability streak before it is trusted for unattended deploys
- default thresholds are `3` consecutive healthy source runs, `3` consecutive analytics-covered runs, and `3` consecutive auto-deploy-eligible runs
- default source stability threshold is `3` consecutive healthy non-fallback runs
- tune these with `XLB_MIN_HEALTHY_STREAK`, `XLB_MIN_ANALYTICS_STREAK`, `XLB_MIN_AUTONOMY_STREAK`, `XLB_MIN_SOURCE_STABILITY_STREAK`, and `XLB_MIN_ANALYTICS_COVERAGE`

### 3. Fetch Cloudflare zone analytics

Use only if the site exists as a Cloudflare zone and you have a zone-based token:

```bash
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_TAG=...
XLB_CF_START=2026-03-26T00:00:00Z
XLB_CF_END=2026-03-27T00:00:00Z
npm run automation:fetch-cloudflare
```

## Long-Term Direction

The preferred long-term pipeline is:

- GA4 exports or API responses for on-site behavior
- Search Console exports or API responses for search impressions and CTR
- AdSense reporting for monetization
- optional Cloudflare snapshot imports for performance or top-level traffic context
